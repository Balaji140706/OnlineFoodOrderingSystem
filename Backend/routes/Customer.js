import express from 'express';
import authenticate from '../middleware/authenticate.js';
import {
    CustomerDetailsController,
    UpdateCustomerDetailsController,
    PreviousOrdersController,
    QueryRestaurantsController,
    RestaurantMenuController,
    PlaceOrderController,
    CustomerOrderItemsController,
    CancelOrderController,
    SubmitRestaurantReviewController,
    SubmitDeliveryReviewController,
    GetOrderReviewsController
} from '../controllers/Customer.js';

const router=express.Router();

router.get('/CustomerDetails',authenticate(['customer']),CustomerDetailsController);
router.put('/UpdateCustomerDetails',authenticate(['customer']),UpdateCustomerDetailsController);
router.get('/PreviousOrders',authenticate(['customer']),PreviousOrdersController);
router.post('/QueryRestaurants',authenticate(['customer']),QueryRestaurantsController);
router.post('/RestaurantMenu',authenticate(['customer']),RestaurantMenuController);
router.post('/PlaceOrder',authenticate(['customer']),PlaceOrderController);
router.post('/CustomerOrderItems',authenticate(['customer']),CustomerOrderItemsController);
router.put('/CancelOrder',authenticate(['customer']),CancelOrderController);
router.post('/SubmitRestaurantReview',authenticate(['customer']),SubmitRestaurantReviewController);
router.post('/SubmitDeliveryReview',authenticate(['customer']),SubmitDeliveryReviewController);
router.post('/GetOrderReviews',authenticate(['customer']),GetOrderReviewsController);

export default router;