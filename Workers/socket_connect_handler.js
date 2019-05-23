var config = require('config');
var restify = require('restify');

var port = config.Host.externalport || 4000;
var io = require('socket.io')(port);

var httpReq = require('request');
var util = require('util');
var uuid = require('node-uuid');


var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var secret = require('dvp-common/Authentication/Secret.js');
var socketioJwt = require("socketio-jwt");
var adapter = require('socket.io-redis');
var redis = require('ioredis');
var redis_handler = require('./redis_handler.js');

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
    io = socketio.listen(rest_server.server);
    io.adapter(adapter({pubClient: redis_handler.pubclient, subClient: redis_handler.subclient}));
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

io.sockets.on('connection', socketioJwt.authorize({
    secret: secret.Secret,
    timeout: 15000 // 15 seconds to send the authentication message
})).on('authenticated', function (socket) {

    console.log(socket.decoded_token.iss);
    console.log('authenticated received ');
    var clientID = socket.decoded_token.iss;
    console.log("Client logged " + clientID);
    socket.emit('clientdetails', clientID);
    console.log(clientID);

    socket.join(clientID);

    socket.on('authenticate', function (data) {
        console.log("authenticate  received from client ");
        console.log("authenticate  : " + JSON.stringify(data));
    });

    socket.on('accept', function (data) {
        console.log("authenticate  received from client ");
        console.log("authenticate  : " + JSON.stringify(data));
    });

    socket.on('reply', function (data) {
        console.log("Reply received from client ");
        console.log("Message : " + data.Message);
        var clientTopic = data.Tkey;
        console.log("Token key from Client " + clientTopic);
        redisManager.ResponseUrlPicker(clientTopic, TTL, function (errURL, resURL) {

            if (errURL) {
                console.log("Error in searching URL ", errURL);
            }
            else {
                if (!resURL || resURL == null || resURL == "") {
                    console.log("Invalid URL records found ", resURL)
                }
                else {
                    var direction = resURL[0];
                    var URL = resURL[1];
                    var reference = resURL[2];

                    console.log("URL " + URL);
                    console.log("DIRECTION " + direction);

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

                            console.log("Reply to sender .... " + JSON.stringify(replyObj));

                            var optionsX = {url: URL, method: "POST", json: replyObj};
                            httpReq(optionsX, function (errorX, responseX, dataX) {

                                if (errorX) {
                                    console.log("ERROR sending request " + errorX);
                                }
                                else if (!errorX && responseX != undefined) {

                                    console.log("Sent " + data + " To " + URL);

                                }
                                else {
                                    console.log("Nooooooo");
                                }
                            });
                        }
                        else {
                            console.log("Invalid Callback URL found " + resURL);
                        }
                    }

                }
            }
        });
    });
    socket.on('disconnect', function (reason) {
        var ClientID = socket.decoded_token.iss;
        console.log("Disconnected " + socket.id + " Reason " + reason);
        console.log("Socket ID ", socket.id);
        console.log("ClientID " + ClientID);

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

module.exports.send_message_agent = function (agent, eventName, message) {

    return new Promise(function (fulfill, reject) {
        io.sockets.adapter.clients([agent], function (err, clients) {
            logger.info('io.sockets.adapter.clients result :: clients :: ' + JSON.stringify(clients) + ' :: err :: ' + err);
            if (!err && (Array.isArray(clients) && clients.length > 0)) {
                io.to(agent).emit(eventName, message);
                console.log("send_message_agent sent");
                fulfill(true)
            } else {
                console.log("Fail to send message Agent : " + agent);
                reject(false);
            }
        });
    });


    /*console.log("send_message_agent  " + "agent : " + agent + " eventName : " + eventName + " : " + JSON.stringify(message));
    io.sockets.adapter.clients([agent], function (err, clients) {
        logger.info('io.sockets.adapter.clients result :: clients :: ' + JSON.stringify(clients) + ' :: err :: ' + err);
        if (!err && (Array.isArray(clients) && clients.length > 0)) {
            io.to(agent).emit(eventName, message);
            console.log("send_message_agent sent");
            return true;
        } else {
            console.log("Fail to send message Agent : " + agent);
            return false;
        }
    });*/
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
