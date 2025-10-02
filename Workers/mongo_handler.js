const mongoose = require("mongoose");
const config = require("config");




var mongoIP=config.Mongo.ip;
var mongoPort=config.Mongo.port;
var dbName=config.Mongo.dbname;
var mongoUser=config.Mongo.user;
var mongoPass = config.Mongo.password;
var mongoreplicaset= config.Mongo.replicaset;
var  mongoType = config.Mongo.type || "mongodb";

//const mongoURI = `${mongoType}://${mongoUser}:${encodeURIComponent(mongoPass)}@${mongoIP}:${mongoPort}/${dbName}`;
if (typeof mongoIP === 'string') {
    mongoIP = mongoIP.includes(',') ? mongoIP.split(',') : [mongoIP];
} else if (!Array.isArray(mongoIP)) {
    throw new Error('Mongo IP configuration must be a string or array');
}
let connectionString = '';
if (mongoIP.length > 1) {
    const hosts = mongoIP.map(ip => `${ip}:${mongoPort}`).join(',');
    connectionString = `mongodb://${mongoUser}:${mongoPass}@${hosts}/${dbName}`;
    if (mongoreplicaset) {
        connectionString += `?replicaSet=${mongoreplicaset}`;
    }
} else {
    connectionString = `mongodb://${mongoUser}:${mongoPass}@${mongoIP[0]}:${mongoPort}/${dbName}`;
}

console.log("MongoDB Connection String:", connectionString);





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


mongoose.connect(connectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

module.exports = mongoose.connection;
