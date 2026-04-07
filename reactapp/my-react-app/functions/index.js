const { setGlobalOptions } = require("firebase-functions/v2");
const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");

const admin = require("firebase-admin");

// Global settings
setGlobalOptions({ maxInstances: 10, region: "us-east1" });

// Lazy Initialization
let db = null;
function getDb() {
  if (!db) {
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    db = admin.firestore();
  }
  return db;
}

// Helper function for CORS
function setCorsHeaders(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

// Helper function to normalize Firestore timestamp/date
function toIsoTime(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

// Validation helpers
const VALID_STYLES = ["hot", "cool", "complete"];
const SAFE_CONTENT_REGEX = /^[A-Za-z0-9 ]+$/;

// Get all shopping list items
exports.getItems = onRequest(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({
      success: false,
      error: "Method not allowed. Use GET.",
    });
    return;
  }

  try {
    const db = getDb();

    const snapshot = await db
      .collection("shoppinglist")
      .orderBy("createdAt", "desc")
      .get();

    if (snapshot.empty) {
      logger.info("No shopping items found");
      res.status(200).json({
        success: true,
        count: 0,
        items: [],
      });
      return;
    }

    const items = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      items.push({
        id: doc.id,
        ...data,
        createdAt: toIsoTime(data.createdAt),
      });
    });

    logger.info(`Retrieved ${items.length} shopping items`);
    res.status(200).json({
      success: true,
      count: items.length,
      items,
    });
  } catch (error) {
    logger.error("Error getting shopping list:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve shopping list",
      message: error.message,
    });
  }
});

// Get single item by ID
exports.getItemById = onRequest(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({
      success: false,
      error: "Method not allowed. Use GET.",
    });
    return;
  }

  try {
    const db = getDb();
    const itemId = req.query.id;

    if (!itemId) {
      res.status(400).json({
        success: false,
        error: "id parameter is required",
      });
      return;
    }

    const docRef = db.collection("shoppinglist").doc(itemId);
    const doc = await docRef.get();

    if (!doc.exists) {
      logger.info(`Item not found: ${itemId}`);
      res.status(404).json({
        success: false,
        error: "Item not found",
      });
      return;
    }

    const data = doc.data();
    const item = {
      id: doc.id,
      ...data,
      createdAt: toIsoTime(data.createdAt),
    };

    logger.info(`Retrieved item: ${itemId}`);
    res.status(200).json({
      success: true,
      item,
    });
  } catch (error) {
    logger.error("Error getting item:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve item",
      message: error.message,
    });
  }
});

// Add item to shopping list
exports.addItem = onRequest(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({
      success: false,
      error: "Method not allowed. Use POST.",
    });
    return;
  }

  try {
    const db = getDb();
    const { content, style, created_by } = req.body || {};

    // Validate content
    if (
      typeof content !== "string" ||
      content.trim() === "" ||
      !SAFE_CONTENT_REGEX.test(content.trim())
    ) {
      res.status(400).json({
        success: false,
        error:
          "content must be a non-empty string using only letters, numbers, and spaces",
      });
      return;
    }

    // Optional style validation
    const itemStyle = style || "cool";
    if (!VALID_STYLES.includes(itemStyle)) {
      res.status(400).json({
        success: false,
        error: `style must be one of: ${VALID_STYLES.join(", ")}`,
      });
      return;
    }

    // Optional created_by validation
    const createdBy = created_by || "anonymous";
    if (typeof createdBy !== "string") {
      res.status(400).json({
        success: false,
        error: "created_by must be a string",
      });
      return;
    }

    const createdAt = new Date();
    const newItem = {
      content: content.trim(),
      style: itemStyle,
      created_by: createdBy,
      createdAt,
    };

    const docRef = await db.collection("shoppinglist").add(newItem);

    logger.info(`New item added with ID: ${docRef.id}`);
    res.status(201).json({
      success: true,
      message: "Item added successfully",
      item: {
        id: docRef.id,
        ...newItem,
        createdAt: createdAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error("Error adding item:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add item",
      message: error.message,
    });
  }
});

// Clear entire shopping list
exports.clearList = onRequest(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST" && req.method !== "DELETE") {
    res.status(405).json({
      success: false,
      error: "Method not allowed. Use POST or DELETE.",
    });
    return;
  }

  try {
    const db = getDb();
    const snapshot = await db.collection("shoppinglist").get();

    if (snapshot.empty) {
      res.status(200).json({
        success: true,
        message: "Shopping list is already empty",
        deletedCount: 0,
      });
      return;
    }

    const batch = db.batch();
    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    logger.info(`Cleared ${snapshot.size} items from shopping list`);
    res.status(200).json({
      success: true,
      message: "Shopping list cleared successfully",
      deletedCount: snapshot.size,
    });
  } catch (error) {
    logger.error("Error clearing shopping list:", error);
    res.status(500).json({
      success: false,
      error: "Failed to clear shopping list",
      message: error.message,
    });
  }
});

// Delete item by ID
exports.deleteItem = onRequest(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "DELETE" && req.method !== "POST") {
    res.status(405).json({
      success: false,
      error: "Method not allowed. Use DELETE or POST.",
    });
    return;
  }

  try {
    const db = getDb();
    const itemId = req.query.id || req.body?.id;

    if (!itemId) {
      res.status(400).json({
        success: false,
        error: "id parameter is required",
      });
      return;
    }

    const docRef = db.collection("shoppinglist").doc(itemId);
    const doc = await docRef.get();

    if (!doc.exists) {
      logger.info(`Item not found for deletion: ${itemId}`);
      res.status(404).json({
        success: false,
        error: "Item not found",
      });
      return;
    }

    await docRef.delete();

    logger.info(`Item deleted: ${itemId}`);
    res.status(200).json({
      success: true,
      message: "Item deleted successfully",
      deletedId: itemId,
    });
  } catch (error) {
    logger.error("Error deleting item:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete item",
      message: error.message,
    });
  }
});