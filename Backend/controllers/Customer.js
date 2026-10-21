import db from '../config/db.js';

export function CustomerDetailsController(req,res){
    const {id}=req.user;
    db.query('select name,email,phoneno,address from customer where id=?',[id],(err,res1)=>{
        if(err) return res.status(500).json({message:"Could not fetch details!"});
        if(!res1.length) return res.status(404).json({message:"Customer not found!"});
        return res.status(200).json(res1[0]);
    });
}

export function UpdateCustomerDetailsController(req,res){
    const {id}=req.user;
    const {name,email,phoneno,address}=req.body;
    db.query('update customer set name=?,email=?,phoneno=?,address=? where id=?',[name,email,phoneno,address,id],(err,result)=>{
        if(err) return res.status(500).json({message:"Could not update details!"});
        if(!result.affectedRows) return res.status(404).json({message:"Customer not found!"});
        return res.status(204).send();
    });
}

export function PreviousOrdersController(req,res){
    const {id}=req.user;
    db.query('select o.id as orderid,r.name as restaurant,o.createdon as timestamp,o.price as total,o.status,d.name as deliveryname,d.phoneno as deliveryphone,d.zoneofoperation as deliveryzone,d.rating as deliveryrating from orders o join restaurant r on r.id=o.restaurantid left join delivery d on d.id=o.deliverypersonid where o.customerid=? order by o.createdon desc',[id],(err,rows)=>{
        if(err) return res.status(500).json({message:"Could not fetch previous orders!"});
        return res.status(200).json(rows);
    });
}

export function QueryRestaurantsController(req,res){
    const {queryString=""}=req.body;
    db.query('select id,name,rating from restaurant where name like ? and availabilitystatus="available" and isactive=1',[`%${queryString}%`],(err,res1)=>{
        if(err) return res.status(500).json({message:"Could not fetch restaurants!"});
        return res.status(200).json(res1);
    });
}

export function RestaurantMenuController(req,res){
    const {restaurantid}=req.body;
    db.query('select id,name,price from menuitems where restaurantid=?',[restaurantid],(err,res1)=>{
        if(err) return res.status(500).json({message:"Could not fetch restaurant menu!"});
        return res.status(200).json(res1);
    });
}

export async function PlaceOrderController(req,res){
    const {id}=req.user;
    const {restaurantid,paymentmethod,items}=req.body;
    if(!Number.isSafeInteger(Number(restaurantid)) || Number(restaurantid)<=0 || !paymentmethod || !Array.isArray(items) || !items.length || !items.every(item=>Number.isSafeInteger(item.menuitemid) && item.menuitemid>0 && Number.isSafeInteger(item.quantity) && item.quantity>0)){
        return res.status(400).json({message:"Invalid order details!"});
    }

    let conn;
    try{
        conn=await db.promise().getConnection();
        await conn.beginTransaction();

        const [restaurants]=await conn.query('select id from restaurant where id=? and availabilitystatus="available" and isactive=1 for update',[restaurantid]);
        if(!restaurants.length){
            await conn.rollback();
            return res.status(409).json({message:"Restaurant is unavailable!"});
        }

        const [partners]=await conn.query('select id from delivery where isactive=1 and availabilitystatus="available" order by rand() limit 1 for update skip locked');
        if(!partners.length){
            await conn.rollback();
            return res.status(409).json({message:"No delivery partners available!"});
        }

        const deliverypersonid=partners[0].id;
        const itemids=[...new Set(items.map(item=>item.menuitemid))];
        const placeholders=itemids.map(()=>"?").join(",");
        const [menu]=await conn.query(`select id,price from menuitems where restaurantid=? and id in (${placeholders})`,[restaurantid,...itemids]);

        if(menu.length!==itemids.length){
            await conn.rollback();
            return res.status(400).json({message:"Invalid menu items!"});
        }

        const prices=new Map(menu.map(item=>[item.id,Number(item.price)]));
        if(menu.some(item=>!Number.isFinite(Number(item.price)) || Number(item.price)<0)){
            await conn.rollback();
            return res.status(400).json({message:"Invalid menu prices!"});
        }

        const totalprice=Math.round(items.reduce((sum,item)=>sum+prices.get(item.menuitemid)*item.quantity,0)*100)/100;
        if(!Number.isFinite(totalprice)) {
            await conn.rollback();
            return res.status(400).json({message:"Invalid order total!"});
        }

        await conn.query('update delivery set availabilitystatus="busy" where id=?',[deliverypersonid]);
        const [order]=await conn.query('insert into orders (customerid,restaurantid,deliverypersonid,status,paymentmethod,price,createdon) values (?,?,?,"pending",?,?,now())',[id,restaurantid,deliverypersonid,paymentmethod,totalprice]);

        for(const item of items){
            await conn.query('insert into orderitems (orderid,menuitemid,quantity,unitprice) values (?,?,?,?)',[order.insertId,item.menuitemid,item.quantity,prices.get(item.menuitemid)]);
        }

        await conn.commit();
        return res.status(201).json({message:"Order placed successfully!",orderid:order.insertId,deliverypersonid,totalprice});
    }
    catch(err){
        console.error(err);
        if(conn) await conn.rollback().catch(console.error);
        return res.status(500).json({message:"Could not place the order!"});
    }
    finally{
        if(conn) conn.release();
    }
}

export function CustomerOrderItemsController(req,res){
    const {id}=req.user;
    const {orderid}=req.body;
    db.query('select m.name,oi.quantity,oi.unitprice from orders o join orderitems oi on o.id=oi.orderid join menuitems m on oi.menuitemid=m.id where o.id=? and o.customerid=?',[orderid,id],(err,res1)=>{
        if(err) return res.status(500).json({message:"Could not fetch order items!"});
        return res.status(200).json(res1);
    });
}

export async function CancelOrderController(req,res){
    const {id}=req.user;
    const {orderid}=req.body;
    let conn;
    try{
        conn=await db.promise().getConnection();
        await conn.beginTransaction();

        const [orders]=await conn.query('select deliverypersonid,status from orders where id=? and customerid=? for update',[orderid,id]);
        if(!orders.length || orders[0].status!=="pending"){
            await conn.rollback();
            return res.status(409).json({message:"Order cannot be cancelled!"});
        }

        const deliveryid=orders[0].deliverypersonid;
        await conn.query('update orders set status="cancelled" where id=?',[orderid]);
        if(deliveryid!==null) await conn.query('update delivery set availabilitystatus="available" where id=?',[deliveryid]);

        await conn.commit();
        return res.status(204).send();
    }
    catch(err){
        console.error(err);
        if(conn) await conn.rollback().catch(console.error);
        return res.status(500).json({message:"Could not cancel order!"});
    }
    finally{
        if(conn) conn.release();
    }
}

export async function SubmitRestaurantReviewController(req, res) {
    const { id } = req.user;
    const { orderid, rating, review = "" } = req.body;

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Invalid rating!" });
    }

    let conn;

    try {
        conn = await db.promise().getConnection();
        await conn.beginTransaction();

        const [orders] = await conn.query(
            `SELECT restaurantid, restaurantrating, status
             FROM orders
             WHERE id = ? AND customerid = ?
             FOR UPDATE`,
            [orderid, id]
        );

        if (!orders.length || orders[0].status !== "fulfilled") {
            await conn.rollback();
            return res.status(403).json({
                message: "Order is not eligible for review!"
            });
        }

        if (orders[0].restaurantrating !== null) {
            await conn.rollback();
            return res.status(409).json({
                message: "Restaurant already reviewed!"
            });
        }

        const restaurantid = orders[0].restaurantid;

        await conn.query(
            `UPDATE orders
             SET restaurantrating = ?, restaurantreview = ?
             WHERE id = ?`,
            [rating, review, orderid]
        );

        await conn.query(
            `UPDATE restaurant
             SET rating = (
                 SELECT AVG(restaurantrating)
                 FROM orders
                 WHERE restaurantid = ?
                   AND restaurantrating IS NOT NULL
             )
             WHERE id = ?`,
            [restaurantid, restaurantid]
        );

        await conn.commit();

        return res.status(201).json({
            message: "Restaurant review submitted!"
        });

    } catch (err) {
        console.error("Restaurant review error:", err);

        if (conn) await conn.rollback().catch(console.error);

        return res.status(500).json({
            message: "Could not submit restaurant review!"
        });

    } finally {
        if (conn) conn.release();
    }
}
export async function SubmitDeliveryReviewController(req, res) {
    const { id } = req.user;
    const { orderid, rating, review = "" } = req.body;

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Invalid rating!" });
    }

    let conn;

    try {
        conn = await db.promise().getConnection();
        await conn.beginTransaction();

        const [orders] = await conn.query(
            `SELECT deliverypersonid, deliverypersonrating, status
             FROM orders
             WHERE id = ? AND customerid = ?
             FOR UPDATE`,
            [orderid, id]
        );

        if (!orders.length || orders[0].status !== "fulfilled") {
            await conn.rollback();
            return res.status(403).json({
                message: "Order is not eligible for review!"
            });
        }

        if (orders[0].deliverypersonrating !== null) {
            await conn.rollback();
            return res.status(409).json({
                message: "Delivery partner already reviewed!"
            });
        }

        const deliverypersonid = orders[0].deliverypersonid;

        if (deliverypersonid === null) {
            await conn.rollback();
            return res.status(409).json({
                message: "No delivery partner assigned!"
            });
        }

        await conn.query(
            `UPDATE orders
             SET deliverypersonrating = ?, deliverypersonreview = ?
             WHERE id = ?`,
            [rating, review, orderid]
        );

        await conn.query(
            `UPDATE delivery
             SET rating = (
                 SELECT AVG(deliverypersonrating)
                 FROM orders
                 WHERE deliverypersonid = ?
                   AND deliverypersonrating IS NOT NULL
             )
             WHERE id = ?`,
            [deliverypersonid, deliverypersonid]
        );

        await conn.commit();

        return res.status(201).json({
            message: "Delivery review submitted!"
        });

    } catch (err) {
        console.error("Delivery review error:", err);

        if (conn) await conn.rollback().catch(console.error);

        return res.status(500).json({
            message: "Could not submit delivery review!"
        });

    } finally {
        if (conn) conn.release();
    }
}
export function GetOrderReviewsController(req,res){
    const {id}=req.user;
    const {orderid}=req.body;
    const sql = `
    SELECT
        o.restaurantrating,
        o.restaurantreview,
        o.deliverypersonrating AS deliveryrating,
        o.deliverypersonreview AS deliveryreview
    FROM orders o
    WHERE o.id = ? AND o.customerid = ?
`;
    db.query(sql,[orderid,id],(err,rows)=>{
        if(err){
            console.log(err);
            return res.status(500).json({message:"Could not fetch reviews!"});
        }
        if(!rows.length) return res.status(404).json({message:"Order not found!"});
        return res.status(200).json(rows[0]);
    });
}