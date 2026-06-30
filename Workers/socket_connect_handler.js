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
var jwt = require('jsonwebtoken');
var socketioJwt = require("socketio-jwt");
var Common = require("./Common.js");
var {createAdapter } = require('@socket.io/redis-adapter');
var redis = require('ioredis');
var redis_handler = require('./redis_handler.js');
var redisClient = redis_handler.redisClient; // ioredis client on the configured DB (db 2) holding "{tenant}:{company}:users:online"
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
var onlineAgents = new Set();
module.exports.initialize_socket = function (rest_server) {
    io = socketio(rest_server.server);
   // io.adapter(adapter({pubClient: redis_handler.pubclient, subClient: redis_handler.subclient}));
   io.adapter(createAdapter (redis_handler.pubclient, redis_handler.subclient));
   // The connection handler at module load bound to the throwaway port-4000 io
   // instance. Agents actually connect to this adapter-backed io (the one used by
   // send_message_agent), so the connection/presence handler MUST be attached here
   // too, otherwise onlineAgents never gets populated and isAgentOnline is always false.
   attachConnectionHandlers(io);
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
function attachConnectionHandlers(io) {
io.sockets.on('connection', function(socket) {
    try {
        logger.info('[PRESENCE][CONNECT] step1 new socket id=%s handshake.auth=%j', socket.id, socket.handshake.auth);

        // Extract token from client handshake auth
        const rawToken = socket.handshake.auth && socket.handshake.auth.token;
        const token = rawToken ? rawToken.split(" ")[1] : undefined; // remove "Bearer "
        logger.info('[PRESENCE][CONNECT] step2 rawToken present=%s extractedToken present=%s', !!rawToken, !!token);

        if (!token) {
            logger.error('[PRESENCE][CONNECT] step2-FAIL no token, disconnecting socket id=%s', socket.id);
            return socket.disconnect();
        }

        // Verify JWT token
        const decoded = jwt.verify(token, secret.Secret);
        socket.decoded_token = decoded;
        logger.info('[PRESENCE][CONNECT] step3 JWT verified for socket id=%s decoded=%j', socket.id, decoded);

        var clientID = decoded.iss;
        logger.info('[PRESENCE][CONNECT] step4 clientID(=decoded.iss)="%s" -> THIS is the room name agents are looked up by', clientID);

        socket.join(clientID);
        onlineAgents.add(clientID);
        logger.info('[PRESENCE][CONNECT] step5 joined room "%s" + added to onlineAgents. total online=%d knownAgents=[%s]',
            clientID, onlineAgents.size, Array.from(onlineAgents).join(', '));

        // Manually trigger 'authenticated' to mimic socketioJwt.authorize behavior
        socket.emit('authenticated');
        socket.authenticated = true;
        logger.info('[PRESENCE][CONNECT] step6 authenticated emitted for room "%s" socket id=%s', clientID, socket.id);

    } catch (err) {
        logger.error('[PRESENCE][CONNECT] step-FAIL JWT verification failed for socket id=%s : %s', socket.id, err);
        socket.disconnect();
    }
})
.on('authenticated', function (socket) {
    logger.info("JWT authenticated for clientID: " + socket.decoded_token.iss);
    logger.info("authenticated received");
    var clientID = socket.decoded_token.iss;

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
        var ClientID = socket.decoded_token && socket.decoded_token.iss;
        onlineAgents.delete(ClientID);
        logger.info('[PRESENCE][DISCONNECT] room "%s" socket id=%s reason=%s. remaining online=%d knownAgents=[%s]',
            ClientID, socket.id, reason, onlineAgents.size, Array.from(onlineAgents).join(', '));
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
}

// Attach to the module-load io instance as well (covers any agents that connect
// to the externalport socket server). The adapter-backed io is wired in
// initialize_socket() once it exists.
attachConnectionHandlers(io);

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
        logger.error('[PRESENCE][SEND] FAIL invalid agent value: %j', agent);
        return reject(false);
        }
        try {
            logger.info('[PRESENCE][SEND] step1 target room="%s" event="%s"', agent, eventName);
            // Diagnostic: does the target room actually have any live socket cluster-wide?
            io.in(agent).allSockets()
                .then(function(ids) {
                    logger.info('[PRESENCE][SEND] step1b room "%s" live sockets=%d %s',
                        agent, (ids && ids.size) || 0,
                        ((ids && ids.size) || 0) === 0 ? '*** NO SOCKET IN THIS ROOM - emit will reach nobody ***' : '');
                })
                .catch(function(e) { logger.error('[PRESENCE][SEND] step1b allSockets error for "%s": %s', agent, e); });

            io.to(agent).emit(eventName, message);
            logger.info('[PRESENCE][SEND] step2 emitted "%s" to room "%s"', eventName, agent);
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

            const saveMessage = (resolvedName) => {
                messageData.name = resolvedName;
                PersonalMessage.create(messageData)
                    .then(doc => {
                        logger.info("Message saved successfully to MongoDB:", doc);
                        fulfill(true);
                    })
                    .catch(err => {
                        logger.error("Failed to save message to MongoDB:", err);
                        reject(false);
                    });
            };

            if (messageData.name) {
                saveMessage(messageData.name);
            } else {
                PersonalMessage.findOne({ wa_id: message.jti, name: { $exists: true, $ne: "" } })
                    .select("name")
                    .then(existing => {
                        saveMessage(existing ? existing.name : "");
                    })
                    .catch(() => saveMessage(""));
            }
            
        } catch (err) {
            logger.error("Unexpected error sending message to agent:", agent, err);
            reject(false);
        }
    });
};

/**
 * Authoritative presence check.
 *
 * The platform tracks agent availability in a Redis hash (DB 2) keyed
 * "{tenant}:{company}:users:online", where each field is an agent's
 * username/profile and the value is the literal string "online" or "offline".
 * This is the same source of truth the rest of the system uses, so we check it
 * directly instead of relying on per-process socket state.
 *
 *   HGET "1:12:users:online" "nipmax"  ->  "online" | "offline" | null
 *
 * @param {string} agentProfile  agent username / ARDS Profile (e.g. "nipmax")
 * @param {string|number} tenant
 * @param {string|number} company
 * @returns {Promise<boolean>}   true only when the stored status === "online"
 */
module.exports.isAgentOnline = function(agentProfile, tenant, company) {
    if (!agentProfile) {
        logger.info('[PRESENCE] isAgentOnline: empty agentProfile -> false');
        return Promise.resolve(false);
    }

    if (tenant === undefined || tenant === null || company === undefined || company === null) {
        logger.error('[PRESENCE] isAgentOnline: missing tenant/company (tenant=%s, company=%s) for agent "%s" -> false',
            tenant, company, agentProfile);
        return Promise.resolve(false);
    }

    var presenceKey = tenant + ':' + company + ':users:online';
    logger.info('[PRESENCE] isAgentOnline: HGET key="%s" field="%s"', presenceKey, agentProfile);

    try {
        return redisClient.hget(presenceKey, agentProfile)
            .then(function(status) {
                var online = (status === 'online');
                logger.info('[PRESENCE] isAgentOnline: key="%s" field="%s" status=%j -> %s',
                    presenceKey, agentProfile, status, online);
                return online;
            })
            .catch(function(err) {
                logger.error('[PRESENCE] isAgentOnline: HGET error key="%s" field="%s" : %s',
                    presenceKey, agentProfile, err);
                return false;
            });
    } catch (ex) {
        logger.error('[PRESENCE] isAgentOnline: exception key="%s" field="%s" : %s',
            presenceKey, agentProfile, ex);
        return Promise.resolve(false);
    }
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
