/**
 * Created by Rajinda on 5/13/2019.
 */

var request = require('request');
var util = require('util');
var config = require('config');
var validator = require('validator');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var Common = require('./Common.js');
var ards = require('./Ards.js');
var socket_handler = require('./socket_connect_handler.js');
var redis_handler = require('./redis_handler.js');
var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');
var uuid = require('node-uuid');
var bot_usr_redis_id = config.Host.botclientusers;

var redisClient = redis_handler.redisClient;

var create_session_id = function () {
    var reqId = uuid.v1();
    return reqId;
};

module.exports.initialize_chat = function (req, res) {
    try {
        if (!req.user || !req.user.tenant || !req.user.company)
            throw new Error("invalid tenant or company.");
        var tenantId = req.user.tenant;
        var companyId = req.user.company;
        req.body.tenantId = tenantId;
        req.body.companyId = companyId;
        req.body.api_session_id = create_session_id();

        var session_data = {
            communication_type:"http",
            call_back_url: req.body.call_back_url, session_id: req.body.api_session_id,
            client_data: {
                jti: req.params.CustomerID,
                name: req.body.Name,
                company: companyId,
                tenant: tenantId,
                channel: req.body.Channel,
                profile: req.body.profile,
                to:req.params.CustomerID,
                sessionId:req.body.api_session_id
            }
        };

        redisClient.hset(bot_usr_redis_id, session_data.session_id, JSON.stringify(session_data), function (err, obj) {
            if (err) {
                jsonString = messageFormatter.FormatMessage(err, "Failed add data to runtime memory.", false, undefined);
                res.end(jsonString);
            }
            else {

                Common.CreateEngagement(req.body, function (error, engagement) {
                    if (error) {
                        jsonString = messageFormatter.FormatMessage(error, "Failed Create Engagement.", false, undefined);
                        res.end(jsonString);
                    }
                    else {
                        var client_data = {
                            tenant: tenantId,
                            company: companyId,
                            jti: req.params.CustomerID,
                            attributes: req.body.Attributes,
                            priority: req.body.priority,
                            resourceCount: 1,
                            otherInfo: req.body.otherInfo,
                            sessionId: req.body.api_session_id
                        };

                        ards.AddRequest(client_data, function (err, req_data) {

                            var resource = JSON.parse(req_data);
                            if (resource && resource.ResourceInfo) {
                                /*jsonString = messageFormatter.FormatMessage(resource, "processing request", true, client_data);
                                res.end(jsonString);
                                socket_handler.send_message_agent(JSON.parse(resource).Profile, 'client', session_data.client_data);*/

                                socket_handler.send_message_agent(resource.ResourceInfo.Profile, 'client', session_data.client_data);

                            } else {
                                jsonString = messageFormatter.FormatMessage(undefined, "processing request", false, {status: "no_agent_found"});
                                res.end(jsonString);
                            }

                        });
                        /*if (engagement) {
                            var client_data = {
                                tenant: tenantId,
                                company: companyId,
                                jti: req.params.CustomerID,
                                attributes: req.body.Attributes,
                                priority: req.body.priority,
                                resourceCount: 1,
                                otherInfo: req.body.otherInfo,
                                sessionId: req.body.api_session_id
                            };

                            ards.PickResource(client_data, function (err, resource) {
                                if (resource && resource.ResourceInfo) {
                                    socket_handler.send_message_agent(resource.ResourceInfo.Profile, 'client', client_data);
                                } else {
                                    jsonString = messageFormatter.FormatMessage(undefined, "processing request", true, {status: "no_agent_found"});
                                    res.end(jsonString);
                                }
                            });
                        }
                        else {
                            jsonString = messageFormatter.FormatMessage(undefined, "Fail to Create Engagement", false, {status: "Fail to Create Engagement"});
                            res.end(jsonString);
                        }*/

                    }
                })
            }
        });
    } catch (ex) {
        var jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, undefined);
        logger.error('initialize_chat - Exception occurred : %s ', jsonString);
        res.end(jsonString);
    }

};

module.exports.agent_found = function (req, res) {
    try {

        var jsonString;
        var resource = req.body;
        if (resource && resource.ResourceInfo) {
            redisClient.hget(bot_usr_redis_id, resource.SessionID, function (err, obj) {
                if (obj) {
                    socket_handler.send_message_agent(resource.ResourceInfo.Profile, 'client', JSON.parse(obj).client_data);
                    jsonString = messageFormatter.FormatMessage(undefined, "agent_found", true, resource);
                } else {
                    jsonString = messageFormatter.FormatMessage(undefined, "agent_found - session expired", false, undefined);
                }
            });
        }
        else {
            jsonString = messageFormatter.FormatMessage(undefined, "agent_found - invalid call back data", false, undefined);
        }

        logger.info('agent_found : %s ', jsonString);
        res.end(jsonString);
    } catch (ex) {
        var jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, undefined);
        logger.error('initialize_chat - Exception occurred : %s ', jsonString);
        res.end(jsonString);
    }
};

module.exports.message_back_to_client = function (req, res) {
    try {

        var jsonString;
        var resource = req.body;
        if (resource) {
            redisClient.hget(bot_usr_redis_id, resource.sessionId, function (err, obj) {
                if (obj) {
                    var call_back_data = JSON.parse(obj);
                    var postdata = Object.assign({}, call_back_data, resource);
                    Common.http_post(call_back_data.call_back_url,postdata,call_back_data.tenant,call_back_data.company);
                    jsonString = messageFormatter.FormatMessage(undefined, "message_back_to_client", true, postdata);
                } else {
                    jsonString = messageFormatter.FormatMessage(undefined, "message_back_to_client - session expired", false, undefined);
                }
            });
        }
        else {
            jsonString = messageFormatter.FormatMessage(undefined, "message_back_to_client - invalid call back data", false, undefined);
        }
        logger.info('message_back_to_client : %s ', jsonString);
        res.end(jsonString);
    } catch (ex) {
        var jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, undefined);
        logger.error('message_back_to_client - Exception occurred : %s ', jsonString);
        res.end(jsonString);
    }
};