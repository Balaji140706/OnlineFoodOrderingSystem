const schema = `MySQL schema (PK=primary key, FK=foreign key, UQ=unique, AI=auto increment; columns nullable unless marked otherwise):
customer(id INT PK AI NOT NULL,name VARCHAR(50) UQ,passwordhash CHAR(60),phoneno CHAR(10),email VARCHAR(50),address VARCHAR(200),createdOn TIMESTAMP,isactive BOOLEAN DEFAULT 1);
restaurant(id INT PK AI NOT NULL,name VARCHAR(50) UQ,phoneno CHAR(10),email VARCHAR(50),address VARCHAR(200),ordercount INT,rating DECIMAL(3,2),createdon TIMESTAMP,passwordhash CHAR(60),isactive BOOLEAN DEFAULT 1,availabilitystatus VARCHAR(20) DEFAULT 'offline');
delivery(id INT PK AI NOT NULL,name VARCHAR(50) UQ,phoneno CHAR(10),email VARCHAR(50),zoneofoperation VARCHAR(200),ordercount INT,rating DECIMAL(3,2),createdon TIMESTAMP,passwordhash CHAR(60),isactive BOOLEAN DEFAULT 1,availabilitystatus VARCHAR(20) DEFAULT 'offline');
menuitems(id INT PK AI NOT NULL,restaurantid INT FK->restaurant.id,name VARCHAR(50),price DECIMAL(6,2));
orders(id INT PK AI NOT NULL,customerid INT FK->customer.id,deliverypersonid INT FK->delivery.id,paymentmethod VARCHAR(50),price DECIMAL(8,2),createdon TIMESTAMP,restaurantid INT FK->restaurant.id,status VARCHAR(10),restaurantrating INT,restaurantreview VARCHAR(500),deliverypersonrating INT,deliverypersonreview VARCHAR(500));
orderitems(orderid INT FK->orders.id,menuitemid INT FK->menuitems.id,quantity INT,unitprice DECIMAL(6,2));`;
export default schema;
