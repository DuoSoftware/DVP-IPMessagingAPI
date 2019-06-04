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
var redis_handler = require('./redis_handler.js');
var socket_handler = require('./socket_connect_handler.js');

var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');
var uuid = require('node-uuid');
var bot_usr_redis_id = config.Host.botclientusers;

var redisClient = redis_handler.redisClient;

var token_duration = parseInt(config.Host.tokenduration);
var long_term_token_duration = parseInt(config.Host.longtermtokenduration);

var create_session_id = function (prefix) {
    var reqId = uuid.v1();
    return util.format("%s-%s", prefix,reqId);
};

var registred_clinet = function (data) {
    var jsonString;
    try{
        redisClient.rpush(bot_usr_redis_id +"_registered", data, function (err, obj) {
            if (err) {
                jsonString = messageFormatter.FormatMessage(err, "Failed add data to runtime memory.", false, undefined);
                logger.error('registred_clinet - Exception occurred : %s ', jsonString);
            }
            else {
                redisClient
            }
        });
    }catch (ex){
        jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, undefined);
        logger.error('registred_clinet - Exception occurred : %s ', jsonString);
    }
};

function remove_request(tenant, company, session_id,reason) {
    try {
        var jsonString;
        ards.RemoveArdsRequest(tenant, company, session_id,reason,function (err,res) {

            jsonString = messageFormatter.FormatMessage(err, "end_chat - RemoveArdsRequest", true, res);
            logger.info('remove_chat_session -RemoveArdsRequest - : %s ', jsonString);
        });
    }catch (ex){
        var jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, undefined);
        logger.error('remove_request - Exception occurred : %s ', jsonString);
    }
}
function remove_chat_session(tenant, company,session_id,reason) {
    try {

        var jsonString;
        remove_request(tenant, company, session_id,reason);
        /*ards.RemoveArdsRequest(tenant, company, session_id,reason,function (err,res) {

            jsonString = messageFormatter.FormatMessage(err, "end_chat - RemoveArdsRequest", true, res);
            logger.info('remove_chat_session -RemoveArdsRequest - : %s ', jsonString);
        });*/

        logger.info("Remove session from online list  -------------------------  : %s ",session_id);
        redisClient.hdel(bot_usr_redis_id, session_id, function (err, obj) {
            if (obj) {
                logger.info("Remove session from online list - Done -------------------------  : %s ",session_id);

            } else {
                logger.error("Remove session from online list - Fails -------------------------  : %s ",session_id);
            }
        });

        var key = "api-" + session_id;
        logger.info("Remove session Information ------------------------- : %s ",key);
        redisClient.del(key, function (err, obj) {
            if (obj) {
                logger.info("Remove session Information - Done ------------------------- : %s ",key);
            } else {
                logger.error("Remove session Information  - Fail------------------------- : %s ",key);
            }
        });
    } catch (ex) {
        var jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, undefined);
        logger.error('remove_chat_session - Exception occurred : %s ', jsonString);
    }
}


function init_and_inform_to_agent(resource, tenantId, companyId) {
    var jsonString;
  return  redisClient.hget(bot_usr_redis_id, resource.SessionID, function (err, sessiondata) {
        if (sessiondata) {
            var key = "api-" + resource.SessionID;
          return  redisClient.get(key, function (err, obj) {
                if (obj) {
                    remove_request(tenantId, companyId, resource.SessionID, 'NoSession');
                    jsonString = messageFormatter.FormatMessage(undefined, "agent_found - invalid request", false, undefined);
                    logger.error('agent_found : %s ', jsonString);
                    return jsonString;
                } else {
                    var msg_data = JSON.parse(sessiondata).client_data;
                    msg_data.Skills = resource.Skills;
                 return   socket_handler.send_message_agent(resource.ResourceInfo.Profile, 'client', msg_data).then(function (value) {
                        if (value) {
                            jsonString = messageFormatter.FormatMessage(undefined, "agent_found", true, resource);
                            logger.info('agent_found : %s ', jsonString);
                        } else {
                            remove_request(tenantId, companyId, resource.SessionID, 'AgentRejected');
                            jsonString = messageFormatter.FormatMessage(undefined, "agent_found - Fail to send message to Agent", false, resource);
                            logger.error('agent_found : %s ', jsonString);
                        }
                     return jsonString;
                    }, function (reason) {
                        //remove_request(tenantId,companyId,resource.SessionID, 'AgentRejected');
                        jsonString = messageFormatter.FormatMessage(reason, "agent_found - Fail to send message to Agent", false, resource);
                        logger.error('agent_found : %s ', jsonString);
                     return jsonString;
                    });

                }
            })
        } else {
            jsonString = messageFormatter.FormatMessage(undefined, "agent_found - session expired", false, undefined);
            remove_chat_session(tenantId, companyId, resource.SessionID, 'NoSession');
            logger.error('agent_found : %s ', jsonString);
            return jsonString;
        }
    });

}


module.exports.register_chat_api_client = function (req, res) {

    var jsonString;
    if (req.body.hub.mode == 'subscribe' && req.body.hub.verify_token == 'token' && req.body.hub.BusinessUnit) {
        var registration_id = create_session_id("registered");
        var data = JSON.stringify({registration_id: registration_id, business_unit: req.body.hub.BusinessUnit});


        redisClient.set(registration_id, data, 'EX', token_duration, function (err, obj) {
            if (err) {
                jsonString = messageFormatter.FormatMessage(err, "Failed Register.", false, undefined);
                res.end(jsonString);
            } else {
                if (obj === "OK") {
                    jsonString = messageFormatter.FormatMessage(undefined, "register_chat_api_client", true, {
                        challenge: req.params.hub.challenge,
                        token: registration_id, expire_after: token_duration
                    });
                }
                else {
                    jsonString = messageFormatter.FormatMessage(err, "Failed Register.", false, undefined);
                }
                res.end(jsonString);
            }
        });
    } else {
        jsonString = messageFormatter.FormatMessage(new Error("Invalid Request"), "register_chat_api_client.", false, undefined);
        res.end(jsonString);
    }
};

module.exports.long_term_token = function (req, res) {


    var jsonString;
    if (req.params["mode"] == 'subscribe' && req.params["verify_token"] == 'token' && req.params["token"]) {

        redisClient.get(req.params["token"], function (err, obj) {
            if (err) {
                jsonString = messageFormatter.FormatMessage(err, "Failed to Register.", false, undefined);
                res.end(jsonString);
            } else {
                if (obj) {
                    var data = JSON.parse(obj);
                    if(data.registration_id===req.params["token"]){
                        var registration_id = create_session_id("register_long");
                        var data = JSON.stringify({registration_id: registration_id, business_unit: data.business_unit});
                        redisClient.set(registration_id, data, 'EX', long_term_token_duration, function (err, obj) {
                            if (err) {
                                jsonString = messageFormatter.FormatMessage(err, "Failed Register.", false, undefined);
                                res.end(jsonString);
                            } else {
                                if (obj==="OK") {
                                    jsonString = messageFormatter.FormatMessage(undefined, "Registered.", true, {
                                        challenge: req.params["challenge"],
                                        token: registration_id,
                                        expire_after: long_term_token_duration
                                    });
                                    res.end(jsonString);
                                } else {
                                    jsonString = messageFormatter.FormatMessage(err, "Failed to Register.", false, undefined);
                                    res.end(jsonString);
                                }
                            }
                        });
                    }else{
                        jsonString = messageFormatter.FormatMessage(new Error("Invalid Token"), "register_chat_api_client.", false, undefined);
                        res.end(jsonString);
                    }
                } else {
                    jsonString = messageFormatter.FormatMessage(new Error("Invalid Request"), "register_chat_api_client.", false, undefined);
                    res.end(jsonString);
                }
            }
        });
    } else {
        jsonString = messageFormatter.FormatMessage(new Error("Invalid Request"), "register_chat_api_client.", false, undefined);
        res.end(jsonString);
    }

};

module.exports.initialize_chat = function (req, res) {
    try {
        if (!req.user || !req.user.tenant || !req.user.company)
            throw new Error("invalid tenant or company.");
        var tenantId = req.user.tenant;
        var companyId = req.user.company;
        req.body.tenantId = tenantId;
        req.body.companyId = companyId;
        req.body.api_session_id = create_session_id("chat");

        logger.info('initialize_chat  : %s ', req.body.api_session_id);
        var session_data = {
            communication_type: "http",
            call_back_url: req.body.call_back_url, session_id: req.body.api_session_id,
            client_data: {
                jti: req.params.CustomerID,
                name: req.body.Name,
                company: companyId,
                tenant: tenantId,
                channel: req.body.Channel,
                profile: req.body.profile,
                to: req.params.CustomerID,
                sessionId: req.body.api_session_id
            }
        };

        redisClient.hset(bot_usr_redis_id, session_data.session_id, JSON.stringify(session_data), function (err, obj) {
            if (err) {
                jsonString = messageFormatter.FormatMessage(err, "Failed add data to runtime memory.", false, undefined);
                res.end(jsonString);
            }
            else {
                logger.info('initialize_chat Set Online Chat List  : %s ', req.body.api_session_id);
                Common.CreateEngagement(req.body, function (error, engagement) {
                    if (error) {
                        jsonString = messageFormatter.FormatMessage(error, "Failed Create Engagement.", false, undefined);
                        res.end(jsonString);
                    }
                    else {
                        logger.info('initialize_chat CreateEngagement  : %s ', req.body.api_session_id);
                        var client_data = {
                            tenant: tenantId,
                            company: companyId,
                            jti: req.params.CustomerID,
                            attributes: req.body.Attributes,
                            priority: req.body.Priority,
                            resourceCount: 1,
                            otherInfo: req.body.otherInfo,
                            sessionId: req.body.api_session_id,
                            businessUnit: req.body.BusinessUnit
                        };

                        ards.AddRequest(client_data, function (err, req_data) {

                            logger.info('initialize_chat AddRequest : %s ', req.body.api_session_id);
                            var resource = req_data;
                            try {
                                if(req_data && typeof req_data == 'string')
                                    resource = JSON.parse(req_data);
                            } catch (ex) {
                                console.error(ex);
                            }

                            if (resource && resource.ResourceInfo) {
                                //socket_handler.send_message_agent(resource.ResourceInfo.Profile, 'client', session_data.client_data);
                                init_and_inform_to_agent(resource, tenantId, companyId).then(function (jsonString) {
                                    logger.info('agent_found -Direct routing  : %s ', jsonString);
                                    res.end(jsonString);
                                },function (reason) {
                                    logger.error('no_agent_found -Direct routing  : %s ', reason);
                                });

                            } else {
                                jsonString = messageFormatter.FormatMessage(undefined, "processing request", false, {
                                    status: "no_agent_found",
                                    data: req_data
                                });
                                logger.info('initialize_chat AddRequest : %s ', jsonString);
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

module.exports.end_chat = function (req, res) {
    try {
        if (!req.user || !req.user.tenant || !req.user.company)
            throw new Error("invalid tenant or company.");
        var tenantId = req.user.tenant;
        var companyId = req.user.company;

        var jsonString;
        var agent_id = req.params.AgentID;
        var session_id = req.params.SessionID;
        if (agent_id && session_id) {
            redisClient.hget(bot_usr_redis_id, session_id, function (err, obj) {
                if (obj) {
                    var call_back_data = JSON.parse(obj);
                    socket_handler.send_message_agent(agent_id, 'sessionend', call_back_data.client_data);
                    jsonString = messageFormatter.FormatMessage(undefined, "end_chat", true, undefined);
                    logger.info('end_chat - : %s ', jsonString);
                } else {
                    jsonString = messageFormatter.FormatMessage(new Error("Invalid Session ID"), "EXCEPTION", false, undefined);
                    logger.error('end_chat - Exception occurred : %s ', jsonString);
                }
                remove_chat_session(tenantId,companyId,session_id, 'NONE');
            });

        } else {
            jsonString = messageFormatter.FormatMessage(new Error("No Agent ID or Session ID"), "EXCEPTION", false, undefined);
            logger.error('end_chat - Exception occurred : %s ', jsonString);
        }
        res.end(jsonString);
    } catch (ex) {
        var jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, undefined);
        logger.error('end_chat - Exception occurred : %s ', jsonString);
        res.end(jsonString);
    }
};

module.exports.send_message_to_agent = function (req, res) {
    try {
        var jsonString;
        var agent_id = req.params.AgentID;
        var session_id = req.params.SessionID;
        if (agent_id && session_id) {
            redisClient.hget(bot_usr_redis_id, session_id, function (err, obj) {
                if (obj) {
                    var call_back_data = JSON.parse(obj);

                    var data = {
                        from: call_back_data.client_data.jti,
                        display: call_back_data.client_data.name,
                        time: Date.now(),
                        to: agent_id,
                        who: 'client',
                        id: uuid.v1(),
                        message: req.body.Message
                    };

                    socket_handler.send_message_agent(agent_id, 'message', data).then(function (value) {
                        if(value){
                            jsonString = messageFormatter.FormatMessage(undefined, "send_message_to_agent", true, undefined);
                            logger.info('send_message_to_agent - : %s ', jsonString);
                        } else{
                            jsonString = messageFormatter.FormatMessage(undefined, "send_message_to_agent - Fail to send message to Agent", false, undefined);
                            logger.error('agent_found : %s ', jsonString);
                        }
                        res.end(jsonString);
                    },function (reason) {
                        //remove_request(tenantId,companyId,resource.SessionID, 'AgentRejected');
                        jsonString = messageFormatter.FormatMessage(reason, "agent_found - Fail to send message to Agent", false, undefined);
                        logger.error('agent_found : %s ', jsonString);
                        res.end(jsonString);
                    });

                } else {
                    jsonString = messageFormatter.FormatMessage(new Error("Invalid Session ID"), "EXCEPTION", false, undefined);
                    logger.error('send_message_to_agent - Exception occurred : %s ', jsonString);
                    res.end(jsonString);
                }
            });

        } else {
            jsonString = messageFormatter.FormatMessage(new Error("No Agent ID or Session ID"), "EXCEPTION", false, undefined);
            logger.error('send_message_to_agent - Exception occurred : %s ', jsonString);
            res.end(jsonString);
        }

    } catch (ex) {
        var jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, undefined);
        logger.error('send_message_to_agent - Exception occurred : %s ', jsonString);
        res.end(jsonString);
    }
};

module.exports.agent_found = function (req, res) {
    try {


        logger.info('------------------------------   agent_found  ------------------ -----------------------------');
        var jsonString;
        if (!req.user || !req.user.tenant || !req.user.company)
            throw new Error("invalid tenant or company.");
        var tenantId = req.user.tenant;
        var companyId = req.user.company;
        var resource = req.body;
        if (resource && resource.ResourceInfo && resource.SessionID) {
            logger.info('agent_found  : %s ', resource.SessionID);

            init_and_inform_to_agent(resource, tenantId, companyId).then(function (jsonString) {
                logger.info('agent_found -  : %s ', jsonString);
                res.end(jsonString);
            },function (reason) {
                logger.error('no_agent_found -  : %s ', reason);
            });
        }
        else {
            jsonString = messageFormatter.FormatMessage(undefined, "agent_found - invalid call back data", false, undefined);
            logger.info('agent_found : %s ', jsonString);
            res.end(jsonString);
        }

    } catch (ex) {
        var jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, undefined);
        logger.error('initialize_chat - Exception occurred : %s ', jsonString);
        res.end(jsonString);
    }
};

module.exports.message_back_to_client = function (req, res) {
    try {

        if (!req.user || !req.user.tenant || !req.user.company)
            throw new Error("invalid tenant or company.");
        var tenantId = req.user.tenant;
        var companyId = req.user.company;
        var jsonString;
        var resource = req.body;
        if (resource) {
            redisClient.hget(bot_usr_redis_id, resource.body.sessionId, function (err, obj) {
                if (obj) {
                    var call_back_data = JSON.parse(obj);
                    resource.client_data = call_back_data.client_data;
                    Common.http_post(call_back_data.call_back_url, resource, call_back_data.tenant, call_back_data.company).then(function (response) {
                        if(response&& response.status===false){
                            remove_chat_session(call_back_data.tenant, call_back_data.company,resource.body.sessionId, 'ClientRejected');
                        }
                        jsonString = messageFormatter.FormatMessage(undefined, "EXCEPTION", true, response);
                        logger.info('message_back_to_client - http_post : %s ', jsonString);
                        res.end(jsonString);
                    },function (error) {
                        jsonString = messageFormatter.FormatMessage(error, "EXCEPTION", false, undefined);
                        logger.error('message_back_to_client - http_post Exception occurred : %s ', jsonString);
                        res.end(jsonString);
                    });

                    if(resource.event_name==="sessionend"){
                        jsonString = messageFormatter.FormatMessage(undefined, "-------------******  Agent End Session ******----------------", true, resource);
                        logger.info('message_back_to_client -  : %s ', jsonString);
                        remove_chat_session(tenantId, companyId,resource.body.sessionId, 'NONE');
                    }
                } else {

                    remove_chat_session(tenantId, companyId,resource.body.sessionId, 'NoSession');
                    jsonString = messageFormatter.FormatMessage(undefined, "message_back_to_client - session expired", false, undefined);
                    logger.info('message_back_to_client : %s ', jsonString);
                    res.end(jsonString);
                }
            });
        }
        else {
            jsonString = messageFormatter.FormatMessage(undefined, "message_back_to_client - invalid call back data", false, undefined);
            logger.info('message_back_to_client : %s ', jsonString);
            res.end(jsonString);
        }

    } catch (ex) {
        var jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, undefined);
        logger.error('message_back_to_client - Exception occurred : %s ', jsonString);
        res.end(jsonString);
    }
};
