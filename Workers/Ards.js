/**
 * Created by Rajinda on 5/13/2019.
 */

var request = require('request');
var util = require('util');
var config = require('config');
var validator = require('validator');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var redis_handler = require('./redis_handler.js');


var call_back_url = config.Services.call_back_url;
var call_back_url_version = config.Services.call_back_url_version;
var call_back_url_port = config.Services.call_back_url_port;

//var server_type = "IPMESSAGINGSERVER";
var server_type = "IPMESSAGINGSERVER";
var server_id = "CHATSERVER";
 
//---------------------------- http methods----------------------------------------------
var httpPost = function (companyInfo, serviceUrl, postData, callback) {
    var jsonStr = JSON.stringify(postData);
    var accessToken = util.format("bearer %s", config.Host.token);
    logger.info('[ARDS] POST %s', serviceUrl);
    var options = {
        url: serviceUrl,
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'authorization': accessToken,
            'companyinfo': companyInfo
        },
        body: jsonStr
    };
    try {
        request.post(options, function optionalCallback(err, httpResponse, body) {
            if (err) {
                logger.error('[ARDS] POST failed:', err);
            }
            callback(err, httpResponse, body);
        });
    }catch(ex){
        callback(ex, undefined, undefined);
    }
};

var httpPut = function (companyInfo, serviceUrl, postData, callback) {
    var jsonStr = JSON.stringify(postData);
    var accessToken = util.format("bearer %s", config.Host.token);
    logger.info('[ARDS] PUT %s', serviceUrl);
    var options = {
        url: serviceUrl,
        method: 'PUT',
        headers: {
            'content-type': 'application/json',
            'authorization': accessToken,
            'companyinfo': companyInfo
        },
        body: jsonStr
    };
    try {
        request.put(options, function optionalCallback(err, httpResponse, body) {
            if (err) {
                logger.error('[ARDS] PUT failed:', err);
            }
            callback(err, httpResponse, body);
        });
    }catch(ex){
        callback(ex, undefined, undefined);
    }
};

var httpGet = function (companyInfo, serviceUrl, callback) {
    var accessToken = util.format("bearer %s", config.Host.token);
    logger.info('[ARDS] GET %s', serviceUrl);
    var options = {
        url: serviceUrl,
        headers: {
            'content-type': 'application/json',
            'authorization': accessToken,
            'companyinfo': companyInfo
        }
    };
    try {
        request(options, function optionalCallback(err, httpResponse, body) {
            if (err) {
                logger.error('[ARDS] GET failed:', err);
            }
            callback(err, httpResponse, body);
        });
    }catch(ex) {
        callback(ex, undefined, undefined);
    }
};

var httpDelete = function (companyInfo, serviceUrl, callback) {
    var accessToken = util.format("bearer %s", config.Host.token);
    logger.info('[ARDS] DELETE %s', serviceUrl);
    var options = {
        url: serviceUrl,
        method: 'DELETE',
        headers: {
            'content-type': 'application/json',
            'authorization': accessToken,
            'companyinfo': companyInfo
        }
    };
    try {
        request(options, function optionalCallback(err, httpResponse, body) {
            if (err) {
                logger.error('[ARDS] DELETE failed:', err);
            }
            callback(err, httpResponse, body);
        });
    }catch(ex) {
        callback(ex, undefined, undefined);
    }
};



//---------------------------Ards methods-------------------------------------------------

var RegisterChatArdsClient = function(){

    var CallbackUrl = util.format("http://%s/DVP/API/%s/IPMessengerAPI/ARDS", call_back_url, call_back_url_version);
    if (validator.isIP(call_back_url)) {
        CallbackUrl = util.format("http://%s:%s/DVP/API/%s/IPMessengerAPI/ARDS", call_back_url, call_back_url_port, call_back_url_version);
    }

    var QueuePositionCallbackUrl = CallbackUrl + "/QueuePosition";

    var reqBody = {
        "ServerType":server_type,
        "RequestType":"CHAT",
        "CallbackUrl":CallbackUrl,
        "CallbackOption":"POST",
        "QueuePositionCallbackUrl":QueuePositionCallbackUrl,
        "ReceiveQueuePosition":true,
        "ServerID":server_id
    };


    try {
        var ardsReqServerUrl = util.format("http://%s/DVP/API/%s/ARDS/requestserver", config.Services.ardsliteservice, config.Services.ardsliteversion);
        if (validator.isIP(config.Services.ardsliteservice)) {
            ardsReqServerUrl = util.format("http://%s:%s/DVP/API/%s/ARDS/requestserver", config.Services.ardsliteservice, config.Services.ardsliteport, config.Services.ardsliteversion);
        }
        var companyInfo = util.format("%d:%d", -1, -1);
        httpPost(companyInfo, ardsReqServerUrl, reqBody, function (err, res1, result) {
            if(err){
                logger.error("[ARDS] RegisterChatArdsClient error: " + err);
            }else{
                if(res1.statusCode === 200) {
                    logger.info("[ARDS] RegisterChatArdsClient success");
                }else{
                    logger.error("[ARDS] RegisterChatArdsClient failed, status " + res1.statusCode);
                }
            }
        });
    }catch(ex){
        logger.error("[ARDS] RegisterChatArdsClient exception: " + ex);
    }
};

var RemoveArdsRequest = function (tenant, company, sessionId, reason, callback) {

    try {
        var ardsReqServerUrl = util.format("http://%s/DVP/API/%s/ARDS/request/%s/%s", config.Services.ardsliteservice, config.Services.ardsliteversion, sessionId, reason);
        if (validator.isIP(config.Services.ardsliteservice)) {
            ardsReqServerUrl = util.format("http://%s:%s/DVP/API/%s/ARDS/request/%s/%s", config.Services.ardsliteservice, config.Services.ardsliteport, config.Services.ardsliteversion, sessionId, reason);
        }
        var companyInfo = util.format("%d:%d", tenant, company);
        httpDelete(companyInfo, ardsReqServerUrl, function (err, res1, result) {
            if(err){
                logger.error("[ARDS] RemoveArdsRequest error: " + err);
                callback(err, undefined);
            }else{
                if(res1.statusCode === 200) {
                    logger.info("[ARDS] RemoveArdsRequest success, session " + sessionId);
                    if(result && result !== "No matching resources at the moment") {
                        callback(undefined, JSON.parse(result));
                    }else{
                        callback(undefined, undefined);
                    }
                }else{
                    logger.error("[ARDS] RemoveArdsRequest failed, status " + res1.statusCode);
                    callback(undefined, undefined);
                }
            }
        });
    }catch(ex){
        logger.error("[ARDS] RemoveArdsRequest exception: " + ex);
        callback(ex, undefined);
    }
};


var AddRequest = function (req_data, callback) {

    var tenant  = req_data.tenant;
    var company  = req_data.company;
    var sessionId= req_data.sessionId;
    var attributes= req_data.attributes;
    var priority = req_data.priority;
    var resourceCount = req_data.resourceCount;
    var otherInfo = req_data.otherInfo;
    var businessUnit = req_data.businessUnit;
    


   /* cJSON_AddNumberToObject(jdata, "Company", company);
    cJSON_AddNumberToObject(jdata, "Tenant", tenant);
    cJSON_AddStringToObject(jdata, "ServerType", "CALLSERVER");
    cJSON_AddStringToObject(jdata, "CallbackOption", "GET");
    cJSON_AddStringToObject(jdata, "RequestType", "CALL");
    cJSON_AddStringToObject(jdata, "SessionId", uuid);
    cJSON_AddStringToObject(jdata, "RequestServerId", globals.id);
    cJSON_AddStringToObject(jdata, "Priority", priority);
    cJSON_AddStringToObject(jdata, "OtherInfo", "");
    cJSON_AddStringToObject(jdata, "BusinessUnit", bussinessunit);*/


    var CallbackUrl = util.format("http://%s/DVP/API/%s/IPMessengerAPI/ARDS", call_back_url, call_back_url_version);
    if (validator.isIP(call_back_url)) {
        CallbackUrl = util.format("http://%s:%s/DVP/API/%s/IPMessengerAPI/ARDS", call_back_url, call_back_url_port, call_back_url_version);
    }
    var reqBody = {
        "Company":company,
        "Tenant":tenant,
        "ServerType": server_type,
        "RequestType": "CHAT",
        "CallbackOption":"POST",
        "SessionId": sessionId,
        "Attributes": (Array.isArray(attributes) ? attributes : [attributes]).map(attr => String(attr)),
        "RequestServerId": server_id,
        "Priority": 0,
        "ResourceCount": resourceCount,
        "OtherInfo": otherInfo,
        "BusinessUnit":businessUnit
    };

    
    try {
        var ardsReqServerUrl = util.format("http://%s/DVP/API/%s/ARDS/request", config.Services.ardsliteservice, config.Services.ardsliteversion);
        if (validator.isIP(config.Services.ardsliteservice)) {
            ardsReqServerUrl = util.format("http://%s:%s/DVP/API/%s/ARDS/request", config.Services.ardsliteservice, config.Services.ardsliteport, config.Services.ardsliteversion);
        }
        var companyInfo = util.format("%d:%d", tenant, company);
        httpPost(companyInfo, ardsReqServerUrl, reqBody, function (err, res1, result) {
            if(err){
                logger.error("[ARDS] AddRequest error: " + err);
                callback(err, undefined);
            }else{

                if(res1.statusCode === 200) {
                    logger.info("[ARDS] AddRequest success, session " + sessionId);
                    var response = JSON.parse(result);
                    callback(undefined, response.Result);
                }else{
                    logger.error("[ARDS] AddRequest failed, status " + res1.statusCode);
                    callback(undefined, undefined);
                }



                /*RemoveArdsRequest(tenant, company, sessionId, 'NONE', function(){
                    if(res1.statusCode === 200) {
                        logger.info("DVP-IPMessagingAPI.PickResource:: Success");
                        var response = JSON.parse(result);
                        callback(undefined, response.Result);
                    }else{
                        logger.info("DVP-IPMessagingAPI.PickResource:: Failed");
                        callback(undefined, undefined);
                    }
                });*/

            }
        });
    }catch(ex){
        logger.error("[ARDS] AddRequest exception: " + ex);
        callback(ex, undefined);
    }
};

var UpdateResource = function(tenant, company, sessionId, resourceId, state, otherInfo, reason, direction) {
    try {
        if(sessionId && company && tenant && resourceId) {

            var companyInfo = util.format("%d:%d", tenant, company);

            var ardsIp = config.Services.ardsliteservice;
            var ardsPort = config.Services.ardsliteport;
            var ardsVersion = config.Services.ardsliteversion;

            if(ardsIp && ardsPort && ardsVersion) {

                var httpUrl = util.format('http://%s/DVP/API/%s/ARDS/resource/%s/concurrencyslot/session/%s?direction=%s', ardsIp, ardsVersion, resourceId, sessionId, direction);

                if(validator.isIP(ardsIp)) {
                    httpUrl = util.format('http://%s:%d/DVP/API/%s/ARDS/resource/%s/concurrencyslot/session/%s?direction=%s', ardsIp, ardsPort, ardsVersion, resourceId, sessionId, direction);
                }


                var jsonObj = {
                    ServerType: server_type,
                    RequestType: "CHAT",
                    State: state,
                    OtherInfo: otherInfo,
                    Reason: reason,
                    Company: company,
                    Tenant: tenant
                };


                httpPut(companyInfo, httpUrl, jsonObj, function (err, res1, result) {
                    if(err){
                        logger.error('[ARDS] UpdateResource error: %s', err);
                    }else{
                        if(res1.statusCode === 200) {
                            logger.info('[ARDS] UpdateResource success, session %s', sessionId);
                        }else{
                            logger.error('[ARDS] UpdateResource failed, status %s', res1.statusCode);
                        }
                    }
                });

            } else {
                logger.error('[ARDS] UpdateResource ARDS endpoints not defined');
            }


        }

    } catch(ex) {
        logger.error('[ARDS] UpdateResource exception: ' + ex);
    }
};

var GetOngoingSessions = function (tenant, company, resourceId, callback) {

    var ongoingSessions = [];

    try {

        var ardsResourceUrl = util.format("http://%s/DVP/API/%s/ARDS/resource/%s", config.Services.ardsliteservice, config.Services.ardsliteversion, resourceId);
        if (validator.isIP(config.Services.ardsliteservice)) {
            ardsResourceUrl = util.format("http://%s:%s/DVP/API/%s/ARDS/resource/%s", config.Services.ardsliteservice, config.Services.ardsliteport, config.Services.ardsliteversion, resourceId);
        }

        var companyInfo = util.format("%d:%d", tenant, company);

        httpGet(companyInfo, ardsResourceUrl, function (err, res1, result) {
            if(err){
                logger.error("[ARDS] GetOngoingSessions error: " + err);
                callback(err, ongoingSessions);
            }else{

                if(res1.statusCode === 200) {

                    logger.info("[ARDS] GetOngoingSessions success, resource " + resourceId);

                    if(result) {
                        var response = JSON.parse(result);

                        if(response && response.IsSuccess && response.Result) {
                            var resourceData = response.Result.obj;

                            if (resourceData && resourceData.ConcurrencyInfo) {
                                for (var i = 0; i < resourceData.ConcurrencyInfo.length; i++) {

                                    var cInfo = resourceData.ConcurrencyInfo[i];
                                    if (cInfo.HandlingType === "CHAT") {
                                        cInfo.SlotInfo.forEach(function (slot) {
                                            if (slot.HandlingRequest && slot.State === "Connected") {
                                                ongoingSessions.push(slot.HandlingRequest);
                                            }
                                        });

                                        break;
                                    }

                                }

                            }
                        }

                    }

                    callback(undefined, ongoingSessions);

                }else{

                    logger.error("[ARDS] GetOngoingSessions failed, status " + res1.statusCode);
                    callback(undefined, ongoingSessions);

                }

            }
        });

    }catch(ex){
        logger.error("[ARDS] GetOngoingSessions exception: " + ex);
        callback(ex, ongoingSessions);
    }
};

module.exports.RegisterChatArdsClient = RegisterChatArdsClient;
module.exports.AddRequest = AddRequest;
module.exports.UpdateResource = UpdateResource;
module.exports.GetOngoingSessions = GetOngoingSessions;
module.exports.RemoveArdsRequest = RemoveArdsRequest;