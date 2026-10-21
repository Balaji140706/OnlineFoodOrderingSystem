import express from 'express';
import authenticate from '../middleware/authenticate.js';
import {DeliveryDetailsController,UpdateDeliveryDetailsController,DeliveryStatisticsController,AssignedOrdersController,OrderItemsController,DeliveryStatusController,UpdateDeliveryStatusController,CompleteOrderController} from '../controllers/Delivery.js';

const router=express.Router();

router.get('/DeliveryDetails',authenticate(['delivery']),DeliveryDetailsController);
router.put('/UpdateDeliveryDetails',authenticate(['delivery']),UpdateDeliveryDetailsController);
router.get('/DeliveryStatistics',authenticate(['delivery']),DeliveryStatisticsController);
router.get('/AssignedOrders',authenticate(['delivery']),AssignedOrdersController);
router.post('/OrderItems',authenticate(['delivery']),OrderItemsController);
router.get('/DeliveryStatus',authenticate(['delivery']),DeliveryStatusController);
router.put('/UpdateDeliveryStatus',authenticate(['delivery']),UpdateDeliveryStatusController);
router.put('/CompleteOrder',authenticate(['delivery']),CompleteOrderController);

export default router;