const axios = require("axios");

/**
 * Receives and processes a new order webhook from ShipStation.
 */
exports.newOrders = async (req, res, next) => {
  try {
    // Retrieve the URL from the ShipStation webhook.
    const url = req.body.resource_url;

    // Pull the new orders
    const response = await shipstationApiCall(url);

    // If there are new orders, analyze the new orders.
    if (response.data.orders.length >= 1) {
      analyzeOrders(response.data.orders);
    }

    // Reply to the REST API request that new orders have been analyzed.
    res.status(200).json({
      message: `Analyzed ${response.data.orders.length} new order(s).`,
      data: response.data.orders,
    });
  } catch (err) {
    console.error(err);
    throw new Error(err);
  }
};

/**
 * Analyzs a new order from ShipStation to determine if a split is necessary.
 *
 * @param  {array} newOrders an array of order objects from ShipStation
 */
const analyzeOrders = async (newOrders) => {
  // Loop through each new order.
  for (let x = 0; x < newOrders.length; x++) {
    try {
      const order = newOrders[x];

      // Create an array of all the individual items (orderItemId) present on the order.
      const orderItems = [
        ...new Set(
          order.items.map((item) => {
            if (item.orderItemId != null) {
              return item.orderItemId;
            }
          })
        ),
      ];

      // If there are multiple items, split the order.
      if (orderItems.length > 1) {
        const orderUpdateArray = splitShipstationOrder(order, orderItems);
        await shipstationApiCall(
          "https://ssapi.shipstation.com/orders/createorders",
          "post",
          orderUpdateArray
        );
      }
    } catch (err) {
      console.error(err);
      throw new Error(err);
    }
  }
};

/**
 * Copies the primary order for each new order.
 *
 * @param  {object} order an order object from the ShipStation API
 * @param {array} orderItems an array of strings containing the orderItemId
 *
 * @return {array} an array of order objects to be updated in ShipStation
 */
const splitShipstationOrder = (order, orderItems) => {
  let orderUpdateArray = [];

  // Loop through every item present on the order.
  for (let x = 0; x < orderItems.length; x++) {
    try {
      // Create a copy of the original order object.
      let tempOrder = { ...order };

      // Give the new order a number to include the orderItemId as a suffix.
      let y = x + 1;
      tempOrder.orderNumber = `${tempOrder.orderNumber}-${y}`;

      // Filter for the order items.
      tempOrder.items = tempOrder.items.filter((item) => {
        return item.orderItemId === orderItems[x];
      });

      // If this is the first (primary) order, set the appropriate tag in ShipStation. The first order is an update. Automation of Tags by SKU could not initially take place as there were multiple items.
      if (x === 0) {
        // Ship-Emmaus
        if (tempOrder.items[0].warehouseLocation !== null) {
          tempOrder.tagIds = [34317];
        }
        // Dropship-AMC
        else if (tempOrder.items[0].sku.startsWith("DRA") || tempOrder.items[0].sku.startsWith("DR2"))  {
          // tempOrder.tagIds = [34316];
          // Only temporary tag below
          tempOrder.tagIds = [34550];
        }
        // Dropship-Impact
        else if (tempOrder.items[0].sku.startsWith("DRI"))  {
          tempOrder.tagIds = [34318];
        }
        // Dropship-Trevco
        else if (tempOrder.items[0].sku.startsWith("DRT"))  {
          tempOrder.tagIds = [34546];
        }
      }
      // If this is not the first (primary) order, set the object to create new order in ShipStation. Tags will be set via automation as this is a new order.
      if (x !== 0) {
        delete tempOrder.orderKey;
        delete tempOrder.orderId;
        tempOrder.amountPaid = 0;
        tempOrder.taxAmount = 0;
        tempOrder.shippingAmount = 0;
      }
      orderUpdateArray.push(tempOrder);
    } catch (err) {
      console.error(err);
      throw new Error(err);
    }
  }

  return orderUpdateArray;
};

/**
 * Performs a ShipStation API Call
 *
 * @param {string} url the full URL to call from ShipStation
 * @param {string} method generally "get" or "post"
 * @param {JSON} body the body of a POST request (if applicable)
 *
 * @return {JSON} the response from the API call
 */
const shipstationApiCall = async (url, method, body) => {
  try {
    const config = {
      method: method || "get",
      url: url,
      headers: {
        // Your API Authorization token goes here.
        Authorization: process.env.SHIPSTATION_API_KEY,
        "Content-Type": "application/json",
      },
    };

    if (body && method.toLowerCase() === "post") {
      config["data"] = JSON.stringify(body);
    }

    const response = await axios(config);
    return response;
  } catch (err) {
    console.error(err);
    throw new Error(err);
  }
};
