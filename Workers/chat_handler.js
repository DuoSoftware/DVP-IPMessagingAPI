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
var  PersonalMessage = require('./model/personal_message.js');
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

// ---------------- Sticky-agent reroute dialog ----------------
// When the sticky agent is offline we ask the customer whether they want to be
// routed to another available agent. We persist the dialog state in Redis so the
// customer's NEXT message can be interpreted as their YES / NO answer.
var REROUTE_DIALOG_ENABLED = false;                      // <-- master switch for the offline reroute dialog feature (currently DISABLED)
var REROUTE_PENDING_PREFIX = "sticky_reroute_pending:"; // value = {agentName, agentId}; set while awaiting the answer
var REROUTE_OPTOUT_PREFIX  = "sticky_reroute_optout:";  // value = "1"; set when customer chose to wait for the sticky agent
var REROUTE_STATE_TTL      = 3600;                       // seconds (1h) for both keys

// Interpret a free-text customer reply as yes / no / unclear.
var interpretRerouteChoice = function (msg) {
    if (!msg) return 'unclear';
    var m = String(msg).trim().toLowerCase();
    if (!m) return 'unclear';
    var first = m.split(/\s+/)[0].replace(/[^a-z]/g, '');
    if (['yes', 'y', 'yeah', 'yep', 'ya', 'sure', 'ok', 'okay'].indexOf(first) >= 0) return 'yes';
    if (['no', 'n', 'nope', 'nah'].indexOf(first) >= 0) return 'no';
    if (m.indexOf('another') >= 0 || m.indexOf('other agent') >= 0 || m.indexOf('available agent') >= 0) return 'yes';
    if (m.indexOf('same agent') >= 0 || m.indexOf('my agent') >= 0 || m.indexOf('sticky') >= 0 || m.indexOf('wait') >= 0) return 'no';
    return 'unclear';
};

// Push an automated message back to the customer over their callback URL.
var sendAutomatedCustomerMessage = function (req, tenantId, companyId, agentName, agentId, text) {
    var payload = {
        event_name: 'message',
        body: {
            to:        req.params.CustomerID,
            agent:     agentId,
            company:   companyId,
            tenant:    tenantId,
            message:   text,
            type:      'text',
            channel:   req.body.channel,
            sessionId: req.body.api_session_id,
            automated: true
        },
        agent: agentName
    };
    // Fire-and-forget, but MUST handle rejection: Common.http_post rejects (with an
    // error) on network failure / non-200. An unhandled rejection here surfaces as a
    // restify domain error and crashes the process.
    Common.http_post(req.body.call_back_url, payload, tenantId, companyId)
        .then(function () {
            logger.info('[STICKY] automated message delivered to "%s"', req.params.CustomerID);
        })
        .catch(function (err) {
            logger.error('[STICKY] automated message to "%s" failed (call_back_url=%s): %s',
                req.params.CustomerID, req.body.call_back_url, err);
        });
};

var registred_clinet = function (data) {
    var jsonString;
    try{
        redisClient.rpush(bot_usr_redis_id +"_registered", data, function (err, obj) {
            if (err) {
                jsonString = messageFormatter.FormatMessage(err, "Failed add data to runtime memory.", false, undefined);
                logger.error('[REGISTER] registred_clinet - Exception occurred : %s ', jsonString);
            }
            else {
                redisClient
            }
        });
    }catch (ex){
        jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, undefined);
        logger.error('[REGISTER] registred_clinet - Exception occurred : %s ', jsonString);
    }
};

function remove_request(tenant, company, session_id,reason) {
    try {
        var jsonString;
        ards.RemoveArdsRequest(tenant, company, session_id,reason,function (err,res) {

            jsonString = messageFormatter.FormatMessage(err, "end_chat - RemoveArdsRequest", true, res);
            logger.info('[SESSION] ards request removed session=%s reason=%s', session_id, reason);
        });
    }catch (ex){
        var jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, undefined);
        logger.error('[SESSION] remove_request - Exception occurred : %s ', jsonString);
    }
}
function remove_chat_session(tenant, company,session_id,reason) {

    logger.info('[SESSION] remove_chat_session session=%s reason=%s', session_id, reason);

    try {

        var jsonString;
        remove_request(tenant, company, session_id,reason);
        /*ards.RemoveArdsRequest(tenant, company, session_id,reason,function (err,res) {

            jsonString = messageFormatter.FormatMessage(err, "end_chat - RemoveArdsRequest", true, res);
            logger.info('remove_chat_session -RemoveArdsRequest - : %s ', jsonString);
        });*/
        if (!session_id.startsWith("chat-")) {
            session_id = "chat-" + session_id;
        }
        redisClient.hdel(bot_usr_redis_id, session_id, function (err, obj) {
            if (obj) {
                logger.info('[SESSION] removed from online list session=%s', session_id);
            } else {
                logger.error('[SESSION] failed to remove from online list session=%s', session_id);
            }
        });

        var key = "api-" + session_id;
        redisClient.del(key, function (err, obj) {
            if (obj) {
                logger.info('[SESSION] removed session information key=%s', key);
            } else {
                logger.error('[SESSION] failed to remove session information key=%s', key);
            }
        });
    } catch (ex) {
        var jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, undefined);
        logger.error('[SESSION] remove_chat_session - Exception occurred : %s ', jsonString);
    }
}


function init_and_inform_to_agent(resource, tenantId, companyId) {
    var jsonString;
    logger.info('[INFORM_AGENT] entry sessionId=%s', resource.SessionID);

  return  redisClient.hget(bot_usr_redis_id, resource.SessionID, function (err, sessiondata) {
        if (sessiondata) {
            logger.info('[INFORM_AGENT] session found sessionId=%s', resource.SessionID);
            var key = "api-" + resource.SessionID;
          return  redisClient.get(key, function (err, obj) {
                if (obj) {
                    remove_request(tenantId, companyId, resource.SessionID, 'NoSession');
                    jsonString = messageFormatter.FormatMessage(undefined, "agent_found - invalid request", false, undefined);
                    logger.info('[INFORM_AGENT] invalid request, session already active sessionId=%s', resource.SessionID);
                    return jsonString;
                } else {
                    var msg_data = JSON.parse(sessiondata).client_data;
                    msg_data.Skills = resource.Skills;
                    msg_data.SessionID = resource.SessionID;
                    msg_data.from = msg_data.jti;
                    msg_data.to = resource.ResourceInfo.ResourceName;
                    msg_data.ResourceId = resource.ResourceInfo.ResourceId;
                    logger.info('[INFORM_AGENT] sending to agent profile=%s sessionId=%s', resource.ResourceInfo.Profile, resource.SessionID);

                 return   socket_handler.send_message_agent(resource.ResourceInfo.Profile, 'client', msg_data).then(function (value) {
                        if (value) {
                            jsonString = messageFormatter.FormatMessage(undefined, "agent_found", true, resource);
                            logger.info('[INFORM_AGENT] agent notified, sticky_agent_map set sessionId=%s', resource.SessionID);
                            redisClient.hset("sticky_agent_map", msg_data.jti, JSON.stringify({
                                agentId: resource.ResourceInfo.ResourceId,
                                agentName: resource.ResourceInfo.Profile
                            }));
                        } else {
                            remove_request(tenantId, companyId, resource.SessionID, 'AgentRejected');
                            jsonString = messageFormatter.FormatMessage(undefined, "agent_found - Fail to send message to Agent", false, resource);
                            logger.error('[INFORM_AGENT] fail to send message to agent sessionId=%s', resource.SessionID);
                        }
                     return jsonString;
                    }, function (reason) {
                        //remove_request(tenantId,companyId,resource.SessionID, 'AgentRejected');
                        jsonString = messageFormatter.FormatMessage(reason, "agent_found - Fail to send message to Agent", false, resource);
                        logger.error('[INFORM_AGENT] fail to send message to agent (rejected) : %s ', jsonString);
                     return jsonString;
                    });

                }
            })
        } else {
            logger.info('[INFORM_AGENT] session not found sessionId=%s', resource.SessionID);
            jsonString = messageFormatter.FormatMessage(undefined, "agent_found - session expired", false, undefined);
            remove_chat_session(tenantId, companyId, resource.SessionID, 'NoSession');
            logger.error('[INFORM_AGENT] session expired, removed chat session sessionId=%s', resource.SessionID);
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
                logger.error('[REGISTER] register_chat_api_client failed to store token');
                res.end(jsonString);
            } else {
                if (obj === "OK") {
                    jsonString = messageFormatter.FormatMessage(undefined, "register_chat_api_client", true, {
                        challenge: req.params.hub.challenge,
                        token: registration_id, expire_after: token_duration
                    });
                    logger.info('[REGISTER] client registered token=%s', registration_id);
                }
                else {
                    jsonString = messageFormatter.FormatMessage(err, "Failed Register.", false, undefined);
                    logger.error('[REGISTER] register_chat_api_client failed to store token');
                }
                res.end(jsonString);
            }
        });
    } else {
        jsonString = messageFormatter.FormatMessage(new Error("Invalid Request"), "register_chat_api_client.", false, undefined);
        logger.error('[REGISTER] register_chat_api_client invalid request');
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
                                    logger.info('[REGISTER] long_term_token issued token=%s', registration_id);
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
        logger.error('[REGISTER] long_term_token invalid request');
        res.end(jsonString);
    }

};

module.exports.initialize_chat = function (req, res) {
    try {
        // console.log("initialize_chat req.body", req.body);
        if (!req.body || !req.body.tenent || !req.body.company)
            throw new Error("invalid tenant or company.");
        var tenantId = req.body.tenent;
        var companyId = req.body.company;
        req.body.tenantId = tenantId;
        req.body.companyId = companyId;
        req.body.api_session_id = create_session_id("chat");
        logger.info('[INIT_CHAT] entry CustomerID=%s sessionId=%s', req.params.CustomerID, req.body.api_session_id);
        var session_data = {
            communication_type: "http",
            call_back_url: req.body.call_back_url, session_id: req.body.api_session_id,
            client_data: {
                jti: req.params.CustomerID,
                name: req.body.name,
                company: companyId,
                tenant: tenantId,
                channel: req.body.channel,
                profile: req.body.profile,
                to: req.params.CustomerID,
                sessionId: req.body.api_session_id,
                attributes: req.body.attributes,
                priority: req.body.priority,
                BusinessUnit: req.body.aud,
                data: req.body.message
            }
        };

        redisClient.hset(bot_usr_redis_id, session_data.session_id, JSON.stringify(session_data), function (err, obj) {
            if (err) {
                jsonString = messageFormatter.FormatMessage(err, "Failed add data to runtime memory.", false, undefined);
                logger.error('[INIT_CHAT] failed to store session sessionId=%s', req.body.api_session_id);
                res.end(jsonString);
            }
            else {
                logger.info('[INIT_CHAT] session stored sessionId=%s', req.body.api_session_id);
                Common.CreateEngagement(req.body, function (error, engagement) {
                    if (error) {
                        jsonString = messageFormatter.FormatMessage(error, "Failed Create Engagement.", false, undefined);
                        logger.error('[INIT_CHAT] failed to create engagement sessionId=%s', req.body.api_session_id);
                        res.end(jsonString);
                    }
                    else {
                        logger.info('[INIT_CHAT] engagement created sessionId=%s', req.body.api_session_id);
                        var client_data = {
                            tenant: tenantId,
                            company: companyId,
                            jti: req.params.CustomerID,
                            channel: req.body.channel,
                            attributes: req.body.attributes,
                            priority: req.body.priority,
                            resourceCount: 1,
                            otherInfo: req.body.otherInfo,
                            sessionId: req.body.api_session_id,
                            businessUnit: req.body.aud
                        };

                        function routeViaArds() {
                            ards.AddRequest(client_data, function (err, req_data) {
                                logger.info('[ARDS_ROUTE] AddRequest sessionId=%s', req.body.api_session_id);
                                var resource = req_data;
                                try {
                                    if (req_data && typeof req_data == 'string')
                                        resource = JSON.parse(req_data);
                                } catch (ex) {
                                    logger.error('[ARDS_ROUTE] failed to parse req_data : %s', ex);
                                }

                                if (resource && resource.ResourceInfo) {
                                    init_and_inform_to_agent(resource, tenantId, companyId).then(function (jsonString) {
                                        logger.info('[ARDS_ROUTE] agent found, direct routing sessionId=%s', req.body.api_session_id);
                                        res.end(jsonString);
                                    }, function (reason) {
                                        logger.error('[ARDS_ROUTE] no agent found, direct routing : %s ', reason);
                                    });
                                } else if (resource && (resource.Position !== undefined || resource.QueueName)) {
                                    jsonString = messageFormatter.FormatMessage(undefined, "processing request", true, {
                                        status: "queued",
                                        data: req_data
                                    });
                                    logger.info('[ARDS_ROUTE] queued position=%s sessionId=%s', resource.Position, req.body.api_session_id);
                                    res.end(jsonString);
                                } else {
                                    jsonString = messageFormatter.FormatMessage(undefined, "processing request", false, {
                                        status: "no_agent_found",
                                        data: req_data
                                    });
                                    logger.info('[ARDS_ROUTE] no agent found sessionId=%s', req.body.api_session_id);
                                    res.end(jsonString);
                                }
                            });
                        }

                        logger.info('[STICKY] step1 lookup sticky_agent_map for CustomerID="%s"', req.params.CustomerID);
                        redisClient.hget("sticky_agent_map", req.params.CustomerID, function(err, stickyVal) {
                            var sticky;

                            // 1) Payload-mapped agent WINS. The request explicitly names the agent this
                            //    contact is mapped to (SocialMediaService's wa_agent_mapping, passed on the
                            //    /Chat/:contactId body as agentMapped/agentResourceId/agentName). This
                            //    overrides any stored conversation-history sticky agent.
                            if (req.body.agentMapped && req.body.agentResourceId && req.body.agentName) {
                                sticky = { agentId: req.body.agentResourceId, agentName: req.body.agentName };
                                logger.info('[STICKY] step1a payload-mapped agent WINS: "%s" (id=%s) for "%s"',
                                    req.body.agentName, req.body.agentResourceId, req.params.CustomerID);
                            }

                            // 2) Otherwise use the conversation-history sticky agent from Redis.
                            if (!sticky && !err && stickyVal) {
                                try {
                                    sticky = JSON.parse(stickyVal);
                                    logger.info('[STICKY] step1b using Redis history sticky "%s" (id=%s) for "%s"',
                                        sticky && sticky.agentName, sticky && sticky.agentId, req.params.CustomerID);
                                } catch (e) {
                                    logger.error('[STICKY] step2-FAIL bad JSON in sticky_agent_map val=%j : %s', stickyVal, e);
                                    sticky = undefined;
                                }
                            }

                            if (!sticky) {
                                logger.info('[STICKY] step1-NONE no sticky agent (err=%j, val=%j) -> routeViaArds for "%s"', err, stickyVal, req.params.CustomerID);
                                return routeViaArds();
                            }

                            logger.info('[STICKY] step2 parsed sticky agentName="%s" agentId="%s"', sticky.agentName, sticky.agentId);

                            var pendingKey = REROUTE_PENDING_PREFIX + req.params.CustomerID;
                            var optoutKey  = REROUTE_OPTOUT_PREFIX + req.params.CustomerID;

                            // Route this chat to the sticky agent (agent confirmed online).
                            function routeToStickyAgent() {
                                var stickyResource = {
                                    SessionID:    req.body.api_session_id,
                                    ResourceInfo: {
                                        Profile:      sticky.agentName,
                                        ResourceName: sticky.agentName,
                                        ResourceId:   sticky.agentId
                                    },
                                    Skills: "ChatSkill"
                                };
                                logger.info('[STICKY] routing chat to sticky agent "%s" (id=%s)', sticky.agentName, sticky.agentId);
                                init_and_inform_to_agent(stickyResource, tenantId, companyId)
                                    .then(function(jsonStr) {
                                        logger.info('[STICKY] sticky route resolved for "%s"', sticky.agentName);
                                        res.end(jsonStr);
                                    })
                                    .catch(function(e) {
                                        logger.error('[STICKY] sticky route failed for "%s" : %s', sticky.agentName, e);
                                        res.end(messageFormatter.FormatMessage(undefined, "initialize_chat", false, {
                                            status: "agent_unavailable",
                                            message: "The agent is busy or unavailable at the moment."
                                        }));
                                    });
                            }

                            // Ask the customer whether they want another agent (and remember we asked).
                            function askRerouteQuestion() {
                                redisClient.set(pendingKey, JSON.stringify({ agentName: sticky.agentName, agentId: sticky.agentId }), 'EX', REROUTE_STATE_TTL);
                                var question = "Your previous conversation was handled by " + sticky.agentName +
                                    ", who is currently offline/busy. Would you like to be connected to another available agent? " +
                                    "Reply YES to chat with another agent, or NO to stay with " + sticky.agentName + ".";
                                logger.info('[STICKY] step5-OFFLINE "%s" offline -> asking reroute question to "%s"', sticky.agentName, req.params.CustomerID);
                                sendAutomatedCustomerMessage(req, tenantId, companyId, sticky.agentName, sticky.agentId, question);
                                res.end(messageFormatter.FormatMessage(undefined, "initialize_chat", true, {
                                    status: "reroute_prompt",
                                    message: question
                                }));
                            }

                            // Feature flag: when the reroute dialog is disabled, fall back to the
                            // simple behaviour — online => route to sticky agent, offline => busy message.
                            if (!REROUTE_DIALOG_ENABLED) {
                                logger.info('[STICKY] reroute dialog DISABLED -> simple availability check for "%s"', sticky.agentName);
                                logger.info('[STICKY] step3 calling isAgentOnline("%s", tenant=%s, company=%s)', sticky.agentName, tenantId, companyId);
                                return socket_handler.isAgentOnline(sticky.agentName, tenantId, companyId).then(function(online) {
                                    logger.info('[STICKY] step4 isAgentOnline("%s") -> %s', sticky.agentName, online);
                                    if (online) {
                                        return routeToStickyAgent();
                                    }
                                    logger.info('[STICKY] step5-OFFLINE "%s" offline/busy -> sending busy message (dialog disabled)', sticky.agentName);
                                    sendAutomatedCustomerMessage(req, tenantId, companyId, sticky.agentName, sticky.agentId,
                                        "The agent is busy or unavailable at the moment. Please try again later.");
                                    return res.end(messageFormatter.FormatMessage(undefined, "initialize_chat", false, {
                                        status: "agent_unavailable",
                                        message: "The agent is busy or unavailable at the moment."
                                    }));
                                }).catch(function(e) {
                                    logger.error('[STICKY] step4-FAIL isAgentOnline("%s") threw -> routeViaArds : %s', sticky.agentName, e);
                                    routeViaArds();
                                });
                            }

                            // 1) Are we waiting for the customer's YES / NO answer to a previous prompt?
                            redisClient.get(pendingKey, function(errP, pendingVal) {
                                if (pendingVal) {
                                    var choice = interpretRerouteChoice(req.body.message);
                                    logger.info('[STICKY] step3 pending reroute answer for "%s": message=%j -> choice=%s', req.params.CustomerID, req.body.message, choice);

                                    if (choice === 'yes') {
                                        redisClient.del(pendingKey);
                                        redisClient.del(optoutKey);
                                        sendAutomatedCustomerMessage(req, tenantId, companyId, sticky.agentName, sticky.agentId,
                                            "Connecting you to the next available agent. Please hold on.");
                                        logger.info('[STICKY] step3-YES rerouting "%s" to next available agent via ARDS', req.params.CustomerID);
                                        return routeViaArds(); // new agent becomes the sticky agent on agent_found
                                    }
                                    if (choice === 'no') {
                                        redisClient.del(pendingKey);
                                        redisClient.set(optoutKey, "1", 'EX', REROUTE_STATE_TTL);
                                        logger.info('[STICKY] step3-NO keeping "%s" with sticky agent "%s"', req.params.CustomerID, sticky.agentName);
                                        sendAutomatedCustomerMessage(req, tenantId, companyId, sticky.agentName, sticky.agentId,
                                            "No problem. We'll keep you connected with " + sticky.agentName + ". They will respond as soon as they are available.");
                                        return res.end(messageFormatter.FormatMessage(undefined, "initialize_chat", true, {
                                            status: "sticky_retained",
                                            message: "Kept with sticky agent."
                                        }));
                                    }
                                    // Unclear answer -> ask again.
                                    logger.info('[STICKY] step3-UNCLEAR re-asking reroute question for "%s"', req.params.CustomerID);
                                    return askRerouteQuestion();
                                }

                                // 2) No pending answer -> check the sticky agent's real availability.
                                logger.info('[STICKY] step3 calling isAgentOnline("%s", tenant=%s, company=%s)', sticky.agentName, tenantId, companyId);
                                socket_handler.isAgentOnline(sticky.agentName, tenantId, companyId).then(function(online) {
                                    logger.info('[STICKY] step4 isAgentOnline("%s") -> %s', sticky.agentName, online);
                                    if (online) {
                                        redisClient.del(optoutKey); // agent is back; clear any earlier "wait" choice
                                        return routeToStickyAgent();
                                    }

                                    // Offline/busy. If the customer already chose to wait, just remind them (don't re-ask).
                                    redisClient.get(optoutKey, function(errO, optedOut) {
                                        if (optedOut) {
                                            logger.info('[STICKY] step5-OFFLINE "%s" offline and customer opted to wait -> reminder only', sticky.agentName);
                                            sendAutomatedCustomerMessage(req, tenantId, companyId, sticky.agentName, sticky.agentId,
                                                sticky.agentName + " is still offline/busy. We'll keep you connected and they'll respond once available.");
                                            return res.end(messageFormatter.FormatMessage(undefined, "initialize_chat", false, {
                                                status: "agent_unavailable",
                                                message: "Sticky agent still offline."
                                            }));
                                        }
                                        return askRerouteQuestion();
                                    });
                                }).catch(function(e) {
                                    logger.error('[STICKY] step4-FAIL isAgentOnline("%s") threw -> routeViaArds : %s', sticky.agentName, e);
                                    routeViaArds();
                                });
                            });
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
        logger.error('[INIT_CHAT] - Exception occurred : %s ', jsonString);
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
                    logger.info('[END_CHAT] session end sent to agent=%s session=%s', agent_id, session_id);
                } else {
                    jsonString = messageFormatter.FormatMessage(new Error("Invalid Session ID"), "EXCEPTION", false, undefined);
                    logger.error('[END_CHAT] invalid session id session=%s', session_id);
                }
                remove_chat_session(tenantId,companyId,session_id, 'NONE');
            });

        } else {
            jsonString = messageFormatter.FormatMessage(new Error("No Agent ID or Session ID"), "EXCEPTION", false, undefined);
            logger.error('[END_CHAT] no agent id or session id');
        }
        res.end(jsonString);
    } catch (ex) {
        var jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, undefined);
        logger.error('[END_CHAT] - Exception occurred : %s ', jsonString);
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
                        sessionId: call_back_data.client_data.sessionId,
                        from: call_back_data.client_data.jti,
                        display: call_back_data.client_data.name,
                        jti: call_back_data.client_data.jti,
                        time: Date.now(),
                        to: agent_id,
                        who: 'client',
                        id: uuid.v1(),
                        message: req.body.Message,
                        company: call_back_data.client_data.company,
                        tenant: call_back_data.client_data.tenant,
                        channel: call_back_data.client_data.channel,
                        BusinessUnit: call_back_data.client_data.BusinessUnit,
                    };

                    socket_handler.send_message_agent(agent_id, 'message', data).then(function (value) {
                        if(value){
                            jsonString = messageFormatter.FormatMessage(undefined, "send_message_to_agent", true, undefined);
                            logger.info('[MSG->AGENT] delivered to agent=%s session=%s', agent_id, session_id);
                        } else{
                            jsonString = messageFormatter.FormatMessage(undefined, "send_message_to_agent - Fail to send message to Agent", false, undefined);
                            logger.error('[MSG->AGENT] fail to send message to agent=%s session=%s', agent_id, session_id);
                        }
                        res.end(jsonString);
                    },function (reason) {
                        //remove_request(tenantId,companyId,resource.SessionID, 'AgentRejected');
                        jsonString = messageFormatter.FormatMessage(reason, "agent_found - Fail to send message to Agent", false, undefined);
                        logger.error('[MSG->AGENT] fail to send message to agent (rejected) : %s ', jsonString);
                        res.end(jsonString);
                    });

                } else {
                    jsonString = messageFormatter.FormatMessage(new Error("Invalid Session ID"), "EXCEPTION", false, undefined);
                    logger.error('[MSG->AGENT] invalid session id session=%s', session_id);
                    res.end(jsonString);
                }
            });

        } else {
            jsonString = messageFormatter.FormatMessage(new Error("No Agent ID or Session ID"), "EXCEPTION", false, undefined);
            logger.error('[MSG->AGENT] no agent id or session id');
            res.end(jsonString);
        }

    } catch (ex) {
        var jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, undefined);
        logger.error('[MSG->AGENT] - Exception occurred : %s ', jsonString);
        res.end(jsonString);
    }
};

module.exports.agent_found = function (req, res) {
    try {
        var jsonString;
        if (!req.user || !req.user.tenant || !req.user.company)
            throw new Error("invalid tenant or company.");
        var tenantId = req.user.tenant;
        var companyId = req.user.company;
        var resource = req.body;
        if (resource && resource.ResourceInfo && resource.SessionID) {
            logger.info('[AGENT_FOUND] entry sessionId=%s', resource.SessionID);

            init_and_inform_to_agent(resource, tenantId, companyId).then(function (jsonString) {
                logger.info('[AGENT_FOUND] informed agent sessionId=%s', resource.SessionID);
                res.end(jsonString);
            },function (reason) {
                logger.error('[AGENT_FOUND] no agent found : %s ', reason);
            });
        }
        else {
            jsonString = messageFormatter.FormatMessage(undefined, "agent_found - invalid call back data", false, undefined);
            logger.info('[AGENT_FOUND] invalid call back data');
            res.end(jsonString);
        }

    } catch (ex) {
        var jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, undefined);
        logger.error('[AGENT_FOUND] - Exception occurred : %s ', jsonString);
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
        let finalData = typeof resource.body.data === 'string' ? JSON.parse(resource.body.data) : resource.body.data;

        if (resource) {
            logger.info('[MSG->CLIENT] entry sessionId=%s', finalData.originalData.sessionId);
            redisClient.hget(bot_usr_redis_id, finalData.originalData.sessionId, function (err, obj) {
                if (obj) {
                    var call_back_data = JSON.parse(obj);
                    resource.client_data = call_back_data.client_data;

                    var payload = Object.assign({}, resource);
                    if (payload.body) {
                        payload.body = Object.assign({}, payload.body);
                        delete payload.body.data;
                    }

                    Common.http_post(call_back_data.call_back_url, payload, call_back_data.tenant, call_back_data.company).then(function (response) {
                        if(response&& response.status===false){
                            remove_chat_session(call_back_data.tenant, call_back_data.company,finalData.originalData.sessionId, 'ClientRejected');
                        }
                        jsonString = messageFormatter.FormatMessage(undefined, "EXCEPTION", true, response);
                        logger.info('[MSG->CLIENT] delivered to client sessionId=%s', finalData.originalData.sessionId);
                        res.end(jsonString);
                    },function (error) {
                        jsonString = messageFormatter.FormatMessage(error, "EXCEPTION", false, undefined);
                        logger.error('[MSG->CLIENT] http_post failed : %s ', jsonString);
                        res.end(jsonString);
                    });

                    if(resource.event_name==="sessionend"){
                        jsonString = messageFormatter.FormatMessage(undefined, "-------------******  Agent End Session ******----------------", true, resource);
                        logger.info('[MSG->CLIENT] agent ended session sessionId=%s', finalData.originalData.sessionId);
                        remove_chat_session(tenantId, companyId,finalData.originalData.sessionId, 'NONE');
                    }
                } else {

                    remove_chat_session(tenantId, companyId,finalData.originalData.sessionId, 'NoSession');
                    jsonString = messageFormatter.FormatMessage(undefined, "message_back_to_client - session expired", false, undefined);
                    logger.info('[MSG->CLIENT] session expired sessionId=%s', finalData.originalData.sessionId);
                    res.end(jsonString);
                }
            });
        }
        else {
            jsonString = messageFormatter.FormatMessage(undefined, "message_back_to_client - invalid call back data", false, undefined);
            logger.info('[MSG->CLIENT] invalid call back data');
            res.end(jsonString);
        }

    } catch (ex) {
        var jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, undefined);
        logger.error('[MSG->CLIENT] - Exception occurred : %s ', jsonString);
        res.end(jsonString);
    }
};
