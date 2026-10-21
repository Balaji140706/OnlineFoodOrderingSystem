import express from 'express';
import authenticate from '../middleware/authenticate.js';
import {RestaurantDetailsController,UpdateRestaurantDetailsController,GetMenuItemsController,AddItemToMenuController,EditMenuItemController,DeleteMenuItemController,RestaurantStatusController,UpdateRestaurantStatusController,RestaurantOrdersController,RestaurantOrderItemsController} from '../controllers/Restaurant.js';

const router=express.Router();

router.get('/RestaurantDetails',authenticate(['restaurant']),RestaurantDetailsController);
router.put('/UpdateRestaurantDetails',authenticate(['restaurant']),UpdateRestaurantDetailsController);
router.get('/MenuItems',authenticate(['restaurant']),GetMenuItemsController);
router.post('/AddMenuItem',authenticate(['restaurant']),AddItemToMenuController);
router.put('/EditMenuItem',authenticate(['restaurant']),EditMenuItemController);
router.delete('/DeleteMenuItem',authenticate(['restaurant']),DeleteMenuItemController);
router.get('/RestaurantStatus',authenticate(['restaurant']),RestaurantStatusController);
router.put('/UpdateRestaurantStatus',authenticate(['restaurant']),UpdateRestaurantStatusController);
router.get('/RestaurantOrders',authenticate(['restaurant']),RestaurantOrdersController);
router.post('/RestaurantOrderItems',authenticate(['restaurant']),RestaurantOrderItemsController);

export default router;