var config = require('config');
var restify = require('restify');

var port = config.Host.externalport || 4000;
var io = require('socket.io')(port);

var httpReq = require('request');
var util = require('util');
var uuid = require('node-uuid');
//var PersonalMessage = require("dvp-mongomodels/model/Room").PersonalMessage;
var  mongoose = require("mongoose");
var  PersonalMessage = require('./model/personal_message.js');
require("./mongo_handler");
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var secret = require('dvp-common/Authentication/Secret.js');
var socketioJwt = require("socketio-jwt");
var Common = require("./Common.js");
var {createAdapter } = require('@socket.io/redis-adapter');
var redis = require('ioredis');
var redis_handler = require('./redis_handler.js');
const { v4: uuidv4 } = require("uuid"); 
var opt = {
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket'],
    allowUpgrades: false,
    cookie: false
};

var socketio = require('socket.io', opt);
var io
module.exports.initialize_socket = function (rest_server) {
    io = socketio(rest_server.server);
   // io.adapter(adapter({pubClient: redis_handler.pubclient, subClient: redis_handler.subclient}));
   io.adapter(createAdapter (redis_handler.pubclient, redis_handler.subclient));
};


/*InitiateSubscriber = function (clientID, msgObj, callback) {

    redisManager.IsRegisteredClient(clientID, function (errReg, status, resReg) {

        if (errReg) {
            console.log("Error in client registration checking " + errReg);
            callback(errReg, undefined);
        }
        else {
            if (resReg && status) {
                var key = "Query:" + uuid.v1();

                redisManager.QuerySubscriberRecorder(key, clientID, function (errSubs, resSubs) {

                    if (errSubs) {
                        console.log("Subcriber record saving error " + errSubs);
                        callback(errSubs, undefined);
                    }
                    else {
                        if (!resSubs) {
                            console.log("Unable to save subs record");
                            callback(new Error("Invalid Data"), undefined)
                        }
                        else {
                            msgObj.RefId = key;
                            var ServerIP = "127.0.0.1:8050";
                            var httpUrl = util.format('http://%s/DVP/API/%s/CEP/ActivateQuery', ServerIP, version);
                            // msgObj.callbackURL=util.format('http://%s/DVP/API/%s/NotificationService/Notification/Publish', ServerIP, version);
                            var options = {
                                url: httpUrl,
                                method: 'POST',
                                json: msgObj,
                                headers: {
                                    'eventName': eventName,
                                    'eventUuid': eventUuid,
                                    'authorization': "bearer " + token,
                                }

                            };

                            console.log(options);
                            try {
                                httpReq(options, function (error, response, body) {
                                    if (!error && response.statusCode == 200) {
                                        console.log("no errrs in request 200 ok");
                                        //callback(undefined,response.statusCode);
                                        callback(undefined, key);

                                    }
                                    else {
                                        console.log("errrs in request  " + error);
                                        callback(error, undefined);
                                        //callback(error,undefined);

                                    }
                                });
                            }
                            catch (ex) {
                                console.log("ex..." + ex);
                                callback(ex, undefined);
                                //callback(ex,undefined);

                            }


                        }
                    }
                });
            }
            else {
                console.log("Client ID  not found  " + clientID);
                callback(new Error("Invalid ClientID"), undefined);
            }
        }
    });
};*/
 
// io.sockets.on('connection', socketioJwt.authorize({
//     secret: secret.Secret,
//     timeout: 15000 // 15 seconds to send the authentication message
// }))
io.sockets.on('connection', function(socket) {
    try {
        // Extract token from client handshake auth
        const token = socket.handshake.auth?.token?.split(" ")[1]; // remove "Bearer "
        logger.info("socket.handshake.auth", socket.handshake.auth);
        
        if (!token) {
            console.log("No token provided, disconnecting socket: " + socket.id);
            return socket.disconnect();
        }

        // Verify JWT token
        const decoded = jwt.verify(token, secret.Secret);
        socket.decoded_token = decoded;

        // Manually trigger 'authenticated' to mimic socketioJwt.authorize behavior
        socket.emit('authenticated');
        socket.authenticated = true;

    } catch (err) {
        logger.error("JWT verification failed for socket: " + socket.id, err)
        socket.disconnect();
    }
})
.on('authenticated', function (socket) {
    logger.info("JWT authenticated for clientID: " + socket.decoded_token.iss);
    logger.info("authenticated received");
    var clientID = socket.decoded_token.iss;
    logger.info("Client logged " + clientID);

    socket.join(clientID);

    socket.on('authenticate', function (data) {
        logger.info("authenticate received from client ");
        logger.info("authenticate  : " + JSON.stringify(data));
    });

    socket.on('accept', function (data) {
        logger.info("accept  received from client ");
        logger.info("accept  : " + JSON.stringify(data));
    });

    socket.on('reply', function (data) {
        logger.info("Reply received from client ");
        logger.info("Reply  : " + JSON.stringify(data));
        var clientTopic = data.Tkey;
        logger.info("Token key from Client " + clientTopic);
        redisManager.ResponseUrlPicker(clientTopic, TTL, function (errURL, resURL) {

            if (errURL) {
                logger.error("Error in searching URL ", errURL);
            }
            else {
                if (!resURL || resURL == null || resURL == "") {
                    logger.error("Invalid URL records found", resURL);
                }
                else {
                    var direction = resURL[0];
                    var URL = resURL[1];
                    var reference = resURL[2];
                    logger.info("URL" + URL, "Direction " + direction, "Reference " + reference);

                    if (direction == "STATELESS") {

                    }
                    else {
                        if (direction == "STATEFUL" && URL != null) {
                            var replyObj = {
                                Reply: data,
                                Topic: clientTopic,
                                Ref: reference
                                //Ref:Refs[clientTopic]
                            };

                            logger.info("Reply to sender .... " + JSON.stringify(replyObj));
                            var optionsX = {url: URL, method: "POST", json: replyObj};
                            httpReq(optionsX, function (errorX, responseX, dataX) {

                                if (errorX) {
                                    logger.error("Error sending request ", errorX);
                                }
                                else if (!errorX && responseX != undefined) {
                                    logger.info("Sent" + data + " To " + URL);
                                }
                                else {
                                    logger.info("No response from " + URL);
                                    
                                }
                            });
                        }
                        else {
                            logger.error("Invalid URL found " + resURL);
                        }
                    }

                }
            }
        });
    });
    socket.on('disconnect', function (reason) {
        var ClientID = socket.decoded_token.iss;
        logger.info("Disconnected " + socket.id + " Reason " + reason);
    });

    socket.emit('message', "Hello " + socket.decoded_token.iss);

    /*socket.on('subscribe', function (subsObj) {

        InitiateSubscriber(clientID, subsObj, function (errSubs, resSubs) {

            if (errSubs) {
                console.log("Error in subscribing Client : " + clientID + " Error : " + errSubs);
            }
            else {
                console.log("Successfully Subscribed, Key : " + resSubs);
            }
        });
    });*/


    /*module.exports.send_message_agent = function (agent,profile,client_data) {
        client_data.profile = profile;
        socket.profile = profile;
        socket.agent = agent;
        io.in(agent).emit("client", client_data);
    }*/
});

// module.exports.send_message_agent = function (agent, eventName, message) {

//     return new Promise(function (fulfill, reject) {
//         console.log("agent");
//         console.log(agent);
//         io.sockets.adapter.clients([agent], function (err, clients) {
        
//         console.log("clients");
//         console.log(clients);
//         console.log(err);

//             logger.info('io.sockets.adapter.clients result :: clients :: ' + JSON.stringify(clients) + ' :: err :: ' + err);
//             // if (!err && (Array.isArray(clients) && clients.length > 0)) {
//                 io.to(agent).emit(eventName, message);
//                 console.log("send_message_agent sent");
//                 fulfill(true)
//             // } else {
//             //     console.log("Fail to send message Agent : " + agent);
//             //     reject(false);
//             // }
//         });
//     });


//     /*console.log("send_message_agent  " + "agent : " + agent + " eventName : " + eventName + " : " + JSON.stringify(message));
//     io.sockets.adapter.clients([agent], function (err, clients) {
//         logger.info('io.sockets.adapter.clients result :: clients :: ' + JSON.stringify(clients) + ' :: err :: ' + err);
//         if (!err && (Array.isArray(clients) && clients.length > 0)) {
//             io.to(agent).emit(eventName, message);
//             console.log("send_message_agent sent");
//             return true;
//         } else {
//             console.log("Fail to send message Agent : " + agent);
//             return false;
//         }
//     });*/
// };
// module.exports.send_message_agent = function(agent, eventName, message) {
//     console.log("Event:", eventName);
//       console.log("Message payload:", message);
//     return new Promise((fulfill, reject) => {
//            if (!agent || typeof agent !== "string") {
//             console.error("Invalid agent value:", agent);
//             return reject(false);
//         }

//         try {
//             console.log("Sending message to agent:", agent);
//             console.log("Event:", eventName);
//             console.log("Message payload:", message);
//             io.to(agent).emit(eventName, message);
//             console.log("send_message_agent sent successfully");
//             fulfill(true);
//         } catch (err) {
//             console.error("Error sending message to agent:", agent, err);
//             reject(false);
//         }
//         // adapter.clients expects a callback with (err, clients)
//         // io.sockets.adapter.clients([agent], (err, clients) => {
//         //     console.log("clients:", clients);
//         //     console.log("err:", err);

//         //     if (!err && clients && clients.length > 0) {
//         //         io.to(agent).emit(eventName, message);
//         //         console.log("send_message_agent sent");
//         //         fulfill(true);
//         //     } else {
//         //         console.log("Fail to send message Agent:", agent);
//         //         reject(false);
//         //     }
//         // });
//     });
// };

module.exports.send_message_agent = function(agent, eventName, message) {
    return new Promise((fulfill, reject) => {
        if (!agent || typeof agent !== "string") {
        logger.error("Invalid agent value:", agent);
        return reject(false);
        }
        try {
            logger.info("Sending message to agent:", agent, "Event:", eventName, "Message payload:", message);
            io.to(agent).emit(eventName, message);
            let id = uuidv4();
            if (require("mongoose").connection.readyState !== 1) {
            logger.error("MongoDB is not connected!");
            return reject(false);
            }

            console.log("Message to be saved to MongoDB:", message);

            const messageData = {
                type: message.type || "text",
                createdAt: new Date(),
                updatedAt: new Date(),
                status: "pending",
                uuid: id,
                message: message.data,
                data: message.data || message.message || "Client Request",
                channel: message.channel || "default",
                wa_id: message.jti,
                session: message.sessionId,
                from: message.from,
                to: agent,
                direction: "inbound",
                agentId: message.ResourceId || "",
                agentName: agent,
                jti: message.jti || "",
                externalUserId: message.externalUserId,
                company: message.company,
                tenant: message.tenant,
                BusinessUnit: message.BusinessUnit || "default",
                name: message.name || ""
            };
            console.log("messageData",messageData);
            

            PersonalMessage.create(messageData)
            .then(doc => {
                logger.info("Message saved successfully to MongoDB:", doc);
                fulfill(true);
            })
            .catch(err => {
                logger.error("Failed to save message to MongoDB:", err);
                reject(false);
            });
            
        } catch (err) {
            logger.error("Unexpected error sending message to agent:", agent, err);
            reject(false);
        }
    });
};

/*
module.exports.send_message = function (clientID) {

    io.sockets.adapter.clients( [clientID], function (err, clients) {
        logger.info('io.sockets.adapter.clients result :: clients :: ' + JSON.stringify(clients) + ' :: err :: ' + err);
        if (!err && (Array.isArray(clients) && clients.length > 0)) {


            io.to(clientID).emit(eventName, msgObj);
            console.log("Notification sent : " + JSON.stringify(msgObj));


        } else {

            console.log("No Message does not persists due to no persists requested.......");
            var jsonString = messageFormatter.FormatMessage(new Error("No Message does not persists due to no persists requested"), "No Message does not persists due to no persists requested", false, undefined);
            res.end(jsonString);
        }

    });
};*/
