const mongoose = require("mongoose");
const config = require("config");




var mongoIP=config.Mongo.ip;
var mongoPort=config.Mongo.port;
var dbName=config.Mongo.dbname;
var mongoUser=config.Mongo.user;
var mongoPass = config.Mongo.password;
var mongoreplicaset= config.Mongo.replicaset;
var  mongoType = config.Mongo.type || "mongodb";

const mongoURI = `${mongoType}://${mongoUser}:${encodeURIComponent(mongoPass)}@${mongoIP}:${mongoPort}/${dbName}`;

mongoose.connection.on("connected", () => {
    console.log("✅ MongoDB connected");
});

mongoose.connection.on("error", (err) => {
    console.error("❌ MongoDB connection error:", err.message);
});

mongoose.connection.on("disconnected", () => {
    console.warn("⚠️ MongoDB disconnected");
});

mongoose.connection.on("reconnected", () => {
    console.log("🔄 MongoDB reconnected");
});

// Connect once at startup
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

module.exports = mongoose.connection;
