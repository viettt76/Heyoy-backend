import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { sendVerificationEmail } from './emailService';
import { checkEmailValid, checkParamValid } from '../util/commonUtil';
const db = require('../models');
require('dotenv').config();

const postBookAppointment = (data) => {
    return new Promise(async (resolve, reject) => {
        try {
            let isValidObj;
            if (data?.who === 'BF1') {
                isValidObj = checkParamValid(data, [
                    'who',
                    'profession',
                    'reason',
                    'userId',
                    'doctorId',
                    'doctorName',
                    'time',
                    'date',
                    'language',
                ]);
            } else if (data?.who === 'BF2') {
                isValidObj = checkParamValid(data, [
                    'who',
                    'fullName',
                    'phoneNumber',
                    'gender',
                    'birthday',
                    'email',
                    'address',
                    'profession',
                    'reason',
                    'userId',
                    'doctorId',
                    'doctorName',
                    'time',
                    'date',
                    'language',
                ]);
            } else {
                resolve({
                    errCode: 3,
                    message: 'Missing information for whom to schedule appointments',
                });
                return;
            }
            if (isValidObj.isValid) {
                let userId = '',
                    userEmail = '',
                    firstName = '',
                    lastName = '';

                // If booking for yourself
                if (data.who === 'BF1') {
                    userId = data.userId;
                    await db.Patient_Info.create({
                        patientId: data.userId,
                        profession: data.profession,
                    });
                    let user = await db.User.findOne({ where: { id: userId } });
                    userEmail = user.email;
                    firstName = user.firstName;
                    lastName = user.lastName;

                    // If booking for relatives
                } else if (data.who === 'BF2') {
                    // Name separation
                    let fullName = data.fullName.replace(/\s+/g, ' ').trim();
                    let arr = fullName.split(' ');
                    if (data.language === 'vi') {
                        firstName = arr[arr.length - 1].trim();
                        lastName = fullName.replace(firstName, '').trim();
                    } else if (data.language === 'en') {
                        firstName = arr[0].trim();
                        lastName = fullName.replace(firstName, '').trim();
                    }
                    if (!checkEmailValid(data.email)) {
                        resolve({
                            errCode: 4,
                            message: 'Email invalid',
                        });
                        return;
                    }
                    userEmail = data.email;
                    const saltRounds = 10;
                    let hashPasswordByBcrypt = await bcrypt.hashSync('123456', saltRounds);
                    let user = await db.User.findOrCreate({
                        where: { email: data.email },
                        defaults: {
                            email: data.email,
                            password: hashPasswordByBcrypt,
                            firstName: firstName,
                            lastName: lastName,
                            address: data.address,
                            birthday: data.birthday,
                            phoneNumber: data.phoneNumber,
                            gender: data.gender,
                            roleId: 'R3',
                        },
                    });
                    // If email is existed => not create
                    if (user && user[1] === false) {
                        resolve({
                            errCode: 2,
                            message: 'Email already exists',
                        });
                        return;
                    }
                    // If email is not existed => create
                    else if (user && user[1] === true) {
                        userId = user[0].id;
                        let isPatientExist = await db.Patient_Info.findOrCreate({
                            where: { patientId: userId },
                            defaults: {
                                patientId: user[0].id,
                                profession: data.profession,
                            },
                        });
                        if (!isPatientExist[1]) {
                            let patient = await db.Patient_Info.findOrCreate({
                                where: { patientId: userId },
                            });
                            patient.profession = data.profession;
                        }
                    }
                }
                let token = uuidv4();
                let appointment = await db.Booking.findOrCreate({
                    where: {
                        doctorId: data.doctorId,
                        patientId: userId,
                        date: data.date,
                        timeType: data.time,
                    },
                    defaults: {
                        statusId: 'S1',
                        doctorId: data.doctorId,
                        patientId: userId,
                        date: data.date,
                        reason: data.reason,
                        timeType: data.time,
                        token: token,
                    },
                });
                if (!appointment[1]) {
                    resolve({
                        errCode: 5,
                        message: 'You have registered for an appointment during this time',
                    });
                    return;
                }
                let time = await db.Allcode.findOne({
                    where: { type: 'time', keyMap: data.time },
                });

                let date = new Date(data.date);

                await sendVerificationEmail({
                    language: data.language,
                    recipientEmail: userEmail,
                    patientFirstName: firstName,
                    patientLastName: lastName,
                    time: `${data.language === 'vi' ? time.valueVi : time.valueEn} - ${date.getDate()}/${
                        date.getMonth() + 1
                    }/${date.getFullYear()}`,
                    doctorName: data.doctorName,
                    href: `${process.env.URL_REACT}/verify-booking?token=${token}&doctorId=${data.doctorId}&patientId=${userId}`,
                });
                resolve({
                    errCode: 0,
                    message: 'Successfully scheduled a medical examination',
                });
            } else {
                resolve({
                    errCode: 3,
                    message: `Missing parameter ${isValidObj.invalidElement}`,
                });
            }
        } catch (error) {
            reject(error);
        }
    });
};

const verifyAppointment = (data) => {
    return new Promise(async (resolve, reject) => {
        try {
            let isValidObj = checkParamValid(data, []);
            if (isValidObj.isValid) {
                let bookingIsExist = await db.Booking.findOne({
                    where: {
                        doctorId: data.doctorId,
                        patientId: data.patientId,
                        token: data.token,
                    },
                });
                if (bookingIsExist) {
                    let bookingNotConfirmed = await db.Booking.findOne({
                        where: {
                            doctorId: data.doctorId,
                            patientId: data.patientId,
                            token: data.token,
                            statusId: 'S1',
                        },
                        raw: false,
                    });
                    if (bookingNotConfirmed) {
                        bookingNotConfirmed.statusId = 'S2';
                        await bookingNotConfirmed.save();
                        resolve({
                            errCode: 0,
                            message: 'Clinic booking confirmed successfully',
                        });
                    } else {
                        resolve({
                            errCode: 4,
                            message: 'Clinic booking has been confirmed',
                        });
                    }
                } else {
                    resolve({
                        errCode: 3,
                        message: 'Clinic booking does not exist',
                    });
                }
            } else {
                resolve({
                    errCode: 5,
                    message: `Missing required parameter ${isValidObj.invalidElement}`,
                });
            }
        } catch (error) {
            reject(error);
        }
    });
};

const handleGetPatientByDoctorAndDate = (doctorId, date) => {
    return new Promise(async (resolve, reject) => {
        try {
            let listPatients = await db.Booking.findAll({
                where: { doctorId: +doctorId, date: +date, statusId: 'S2' },
                include: [
                    {
                        model: db.Patient_Info,
                        include: [
                            {
                                model: db.User,
                                attributes: ['firstName', 'lastName', 'address', 'gender', 'birthday', 'email'],
                                include: [
                                    {
                                        model: db.Allcode,
                                        as: 'genderData',
                                        attributes: ['valueVi', 'valueEn'],
                                    },
                                ],
                            },
                        ],
                    },
                    { model: db.Allcode, as: 'timeTypeBookingData', attributes: ['valueVi', 'valueEn'] },
                ],
                raw: false,
                nest: true,
            });
            if (listPatients?.length > 0) {
                resolve({
                    errCode: 0,
                    data: listPatients,
                });
            } else {
                resolve({
                    errCode: 2,
                    message: 'No patient found',
                });
            }
        } catch (error) {
            reject(error);
        }
    });
};

const handleGetAppointmentByPatient = (patientId) => {
    return new Promise(async (resolve, reject) => {
        try {
            let listAppointment = await db.Booking.findAll({
                where: { patientId: patientId },
                include: [
                    { model: db.Allcode, as: 'timeTypeBookingData', attributes: ['valueVi', 'valueEn'] },
                    { model: db.Allcode, as: 'statusBookingData', attributes: ['valueVi', 'valueEn'] },
                    {
                        model: db.User,
                        as: 'doctorUserData',
                        attributes: ['firstName', 'lastName'],
                    },
                    {
                        model: db.Doctor_Info,
                        include: [{ model: db.Specialty, as: 'specialtyData', attributes: ['name'] }],
                    },
                ],
                raw: false,
                nest: true,
            });
            if (listAppointment?.length > 0) {
                resolve({
                    errCode: 0,
                    data: listAppointment,
                });
            } else {
                resolve({
                    errCode: 2,
                    message: 'No appointment found',
                });
            }
        } catch (error) {
            reject(error);
        }
    });
};

module.exports = {
    postBookAppointment,
    verifyAppointment,
    handleGetPatientByDoctorAndDate,
    handleGetAppointmentByPatient,
};
