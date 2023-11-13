import express from 'express';
import homeController from '../controllers/homeController';
import userController from '../controllers/userController';

let router = express.Router();

let initWebRoutes = (app) => {
    router.get('/', homeController.getHomePage);

    router.get('/create-crud', homeController.createUser);
    router.post('/post-crud', homeController.postCRUD);
    router.get('/get-crud', homeController.displayGetCRUD);
    router.get('/edit-crud', homeController.editCRUD);

    // Do methods put cần cài thêm package mà project về sau không
    // cần views nên dùng tạm method post
    router.post('/put-crud', homeController.putCRUD);
    router.get('/delete-crud', homeController.deleteCRUD);

    router.post('/api/login', userController.handleLogin);
    router.get('/api/get-user', userController.handleGetUser);
    router.post('/api/create-user', userController.handleCreateUser);
    router.put('/api/update-user', userController.handleEditUser);
    router.delete('/api/delete-user', userController.handleDeleteUser);


    router.get('/api/get-all-code', userController.getAllCode)

    return app.use('/', router);
};

module.exports = initWebRoutes;
