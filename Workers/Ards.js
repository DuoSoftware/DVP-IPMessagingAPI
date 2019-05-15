/**
 * Created by Rajinda on 5/13/2019.
 */

var request = require('request');
var util = require('util');
var config = require('config');
var validator = require('validator');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;




//---------------------------- http methods----------------------------------------------
var httpPost = function (companyInfo, serviceUrl, postData, callback) {
    var jsonStr = JSON.stringify(postData);
    var accessToken = util.format("bearer %s", config.Host.token);
    console.log('HTTP POST Request:: %s', serviceUrl);
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
                console.log('upload failed:', err);
            }
            console.log('Server returned: %j', body);
            callback(err, httpResponse, body);
        });
    }catch(ex){
        callback(ex, undefined, undefined);
    }
};

var httpPut = function (companyInfo, serviceUrl, postData, callback) {
    var jsonStr = JSON.stringify(postData);
    var accessToken = util.format("bearer %s", config.Host.token);
    console.log('HTTP PUT Request:: %s', serviceUrl);
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
                console.log('upload failed:', err);
            }
            console.log('Server returned: %j', body);
            callback(err, httpResponse, body);
        });
    }catch(ex){
        callback(ex, undefined, undefined);
    }
};

var httpGet = function (companyInfo, serviceUrl, callback) {
    var accessToken = util.format("bearer %s", config.Host.token);
    console.log('HTTP GET Request:: %s', serviceUrl);
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
                console.log('upload failed:', err);
            }
            console.log('Server returned: %j', body);
            callback(err, httpResponse, body);
        });
    }catch(ex) {
        callback(ex, undefined, undefined);
    }
};

var httpDelete = function (companyInfo, serviceUrl, callback) {
    var accessToken = util.format("bearer %s", config.Host.token);
    console.log('HTTP GET Request:: %s', serviceUrl);
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
                console.log('upload failed:', err);
            }
            console.log('Server returned: %j', body);
            callback(err, httpResponse, body);
        });
    }catch(ex) {
        callback(ex, undefined, undefined);
    }
};



//---------------------------Ards methods-------------------------------------------------

var RegisterChatArdsClient = function(){

    var CallbackUrl = util.format("http://%s/DVP/API/%s/IPMessengerAPI/ARDS", config.Services.call_back_url, config.Services.call_back_url_version);
    if (validator.isIP(config.Services.call_back_url)) {
        CallbackUrl = util.format("http://%s:%s/DVP/API/%s/IPMessengerAPI/ARDS/requestserver", config.Services.call_back_url, config.Services.call_back_url_port, config.Services.call_back_url_version);
    }

    var QueuePositionCallbackUrl = CallbackUrl + "/QueuePosition";

    var reqBody = {
        "ServerType":"IPMESSAGINGSERVER",
        "RequestType":"CHAT",
        "CallbackUrl":CallbackUrl,
        "CallbackOption":"",
        "QueuePositionCallbackUrl":QueuePositionCallbackUrl,
        "ReceiveQueuePosition":true,
        "ServerID":"CHATSERVER"
    };

    try {
        var ardsReqServerUrl = util.format("http://%s/DVP/API/%s/ARDS/requestserver", config.Services.ardsliteservice, config.Services.ardsliteversion);
        if (validator.isIP(config.Services.ardsliteservice)) {
            ardsReqServerUrl = util.format("http://%s:%s/DVP/API/%s/ARDS/requestserver", config.Services.ardsliteservice, config.Services.ardsliteport, config.Services.ardsliteversion);
        }
        var companyInfo = util.format("%d:%d", -1, -1);
        httpPost(companyInfo, ardsReqServerUrl, reqBody, function (err, res1, result) {
            if(err){
                logger.error("DVP-IPMessagingAPI.RegisterChatArdsClient:: Error::"+ err);
            }else{
                if(res1.statusCode === 200) {
                    logger.info("DVP-IPMessagingAPI.RegisterChatArdsClient:: Success");
                }else{
                    logger.info("DVP-IPMessagingAPI.RegisterChatArdsClient:: Failed");
                }
            }
        });
    }catch(ex){
        logger.error("DVP-IPMessagingAPI.RegisterChatArdsClient:: Exception::"+ ex);
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
                logger.error("DVP-IPMessagingAPI.RemoveArdsRequest:: Error::"+ err);
                callback(err, undefined);
            }else{
                if(res1.statusCode === 200) {
                    logger.info("DVP-IPMessagingAPI.RemoveArdsRequest:: Success");
                    if(result && result !== "No matching resources at the moment") {
                        callback(undefined, JSON.parse(result));
                    }else{
                        callback(undefined, undefined);
                    }
                }else{
                    logger.info("DVP-IPMessagingAPI.RemoveArdsRequest:: Failed");
                    callback(undefined, undefined);
                }
            }
        });
    }catch(ex){
        logger.error("DVP-IPMessagingAPI.RemoveArdsRequest:: Exception::"+ ex);
        callback(ex, undefined);
    }
};


var AddRequest = function (req_data, callback) {

    var tenant  = req_data.tenant;
    var company  = req_data.company;
    var sessionId= req_data.sessionId;
    var attributes=req_data.attributes;
    var priority = req_data.priority;
    var resourceCount = req_data.resourceCount;
    var otherInfo = req_data.otherInfo;

    var reqBody = {
        "ServerType": "IPMESSAGINGSERVER",
        "RequestType": "CHAT",
        "SessionId": sessionId,
        "Attributes": attributes,
        "RequestServerId": "CHATSERVER",
        "Priority": priority,
        "ResourceCount": resourceCount,
        "OtherInfo": otherInfo
    };


    try {
        var ardsReqServerUrl = util.format("http://%s/DVP/API/%s/ARDS/request", config.Services.ardsliteservice, config.Services.ardsliteversion);
        if (validator.isIP(config.Services.ardsliteservice)) {
            ardsReqServerUrl = util.format("http://%s:%s/DVP/API/%s/ARDS/request", config.Services.ardsliteservice, config.Services.ardsliteport, config.Services.ardsliteversion);
        }
        var companyInfo = util.format("%d:%d", tenant, company);
        httpPost(companyInfo, ardsReqServerUrl, reqBody, function (err, res1, result) {
            if(err){
                logger.error("DVP-IPMessagingAPI.PickResource:: Error::"+ err);
                callback(err, undefined);
            }else{

                RemoveArdsRequest(tenant, company, sessionId, 'NONE', function(){
                    if(res1.statusCode === 200) {
                        logger.info("DVP-IPMessagingAPI.PickResource:: Success");
                        var response = JSON.parse(result);
                        callback(undefined, response.Result);
                    }else{
                        logger.info("DVP-IPMessagingAPI.PickResource:: Failed");
                        callback(undefined, undefined);
                    }
                });

            }
        });
    }catch(ex){
        logger.error("DVP-IPMessagingAPI.PickResource:: Exception::"+ ex);
        callback(ex, undefined);
    }
};

var UpdateResource = function(tenant, company, sessionId, resourceId, state, otherInfo, reason, direction) {
    try {
        if(sessionId && company && tenant && resourceId) {

            logger.debug('[DVP-IPMessagingAPI.SendResourceStatus] -  Creating PUT Message');

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
                    ServerType: "IPMESSAGINGSERVER",
                    RequestType: "CHAT",
                    State: state,
                    OtherInfo: otherInfo,
                    Reason: reason,
                    Company: company,
                    Tenant: tenant
                };


                httpPut(companyInfo, httpUrl, jsonObj, function (err, res1, result) {
                    if(err){
                        logger.error('[DVP-IPMessagingAPI.SendResourceStatus] - Set Resource Status Fail - Error : [%s]', err);
                    }else{
                        if(res1.statusCode === 200) {
                            logger.debug('[DVP-IPMessagingAPI.SendResourceStatus] - Set Resource Status Success : %s', result);
                        }else{
                            logger.error('[DVP-IPMessagingAPI.SendResourceStatus] - Set Resource Status Fail - Response : [%s]', JSON.stringify(res1));
                        }
                    }
                });

            } else {
                logger.error('[DVP-IPMessagingAPI.SendResourceStatus] - ARDS Endpoints not defined', new Error('ARDS Endpoints not defined'));
            }


        }

    } catch(ex) {
        logger.error('[DVP-IPMessagingAPI.SendResourceStatus] - Exception Occurred', ex);
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
                logger.error("DVP-IPMessagingAPI.GetOngoingSessions:: Error::"+ err);
                callback(err, ongoingSessions);
            }else{

                if(res1.statusCode === 200) {

                    logger.info("DVP-IPMessagingAPI.GetOngoingSessions:: Success");

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

                    logger.info("DVP-IPMessagingAPI.GetOngoingSessions:: Failed");
                    callback(undefined, ongoingSessions);

                }

            }
        });

    }catch(ex){
        logger.error("DVP-IPMessagingAPI.GetOngoingSessions:: Exception::"+ ex);
        callback(ex, ongoingSessions);
    }
};

module.exports.RegisterChatArdsClient = RegisterChatArdsClient;
module.exports.AddRequest = AddRequest;
module.exports.UpdateResource = UpdateResource;
module.exports.GetOngoingSessions = GetOngoingSessions;