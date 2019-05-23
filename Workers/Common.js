/**
 * Created by Sukitha on 1/13/2017.
 */

var util = require('util');
var config = require('config');
var request = require("request");
var validator = require('validator');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var token = util.format("Bearer %s", config.Host.token);
var uuid = require('node-uuid');
var redis = require('ioredis');

var redisip = config.Security.ip;
var redisport = config.Security.port;
var redispass = config.Security.password;
var redismode = config.Security.mode;
var redisdb = config.Security.db;


var redisSetting = {
    port: redisport,
    host: redisip,
    family: 4,
    db: redisdb,
    password: redispass,
    retryStrategy: function (times) {
        var delay = Math.min(times * 50, 2000);
        return delay;
    },
    reconnectOnError: function (err) {

        return true;
    }
};

if (redismode == 'sentinel') {

    if (config.Security.sentinels && config.Security.sentinels.hosts && config.Security.sentinels.port && config.Security.sentinels.name) {
        var sentinelHosts = config.Security.sentinels.hosts.split(',');
        if (Array.isArray(sentinelHosts) && sentinelHosts.length > 2) {
            var sentinelConnections = [];

            sentinelHosts.forEach(function (item) {

                sentinelConnections.push({host: item, port: config.Security.sentinels.port})

            });

            redisSetting = {
                sentinels: sentinelConnections,
                name: config.Security.sentinels.name,
                password: redispass
            }

        } else {

            console.log("No enough sentinel servers found .........");
        }

    }
}

var redisClient = undefined;

if (redismode != "cluster") {
    redisClient = new redis(redisSetting);
} else {

    var redisHosts = redisip.split(",");
    if (Array.isArray(redisHosts)) {


        redisSetting = [];
        redisHosts.forEach(function (item) {
            redisSetting.push({
                host: item,
                port: redisport,
                family: 4,
                password: redispass
            });
        });

        var redisClient = new redis.Cluster([redisSetting]);

    } else {

        redisClient = new redis(redisSetting);
    }


}


redisClient.on("error", function (err) {
    logger.error("Error ", err);

});

redisClient.on("connected", function () {
    logger.info("Redis Connected ");


});


module.exports.CompanyChatSecret = function (req, payload, done) {

    //var session = uuid.v1();

    if (payload && payload.iss && payload.jti && payload.name && payload.company && payload.tenant) {
        var issuer = payload.iss;
        var jti = payload.jti;

        //payload.session = payload.jti;
        var chatKey = util.format('%d:%d:keys:chat:public', payload.tenant, payload.company);

        redisClient.get(chatKey, function (err, key) {

            if (err) {
                return done(err);
            }
            if (!key) {
                return done(new Error('missing_secret'));
            } else {

                return done(null, key);
            }
        });
    } else {
        done(new Error('wrong token format'));
    }
};

module.exports.CreateEngagement = function (payload, cb) {

    if ((config.Services && config.Services.interactionurl && config.Services.interactionport && config.Services.interactionversion)) {


        var engagementURL = util.format("http://%s/DVP/API/%s/EngagementSessionForProfile", config.Services.interactionurl, config.Services.interactionversion);
        if (validator.isIP(config.Services.interactionurl))
            engagementURL = util.format("http://%s:%d/DVP/API/%s/EngagementSessionForProfile", config.Services.interactionurl, config.Services.interactionport, config.Services.interactionversion);

        var engagementData = {
            "engagement_id": payload.jti,
            "channel": 'chat',
            "direction": 'inbound',
            "channel_from": payload.jti,
            "channel_to": payload.iss
        };



        if (payload.api_session_id)
            engagementData.engagement_id = payload.api_session_id;


        if (payload.Channel) {
            engagementData.channel = payload.Channel;
        }

        if (payload.jti) {
            engagementData.channel_id = payload.jti;
            //req.body.channel_id
        }

        if (payload.contact) {
            engagementData.raw = payload.Contact;
        }

        logger.debug("Calling Engagement service URL %s", engagementURL);
        request({
            method: "POST",
            url: engagementURL,
            headers: {
                authorization: token,
                companyinfo: util.format("%d:%d", payload.tenantId, payload.companyId)
            },
            json: engagementData
        }, function (_error, _response, datax) {

            try {

                if (!_error && _response && _response.statusCode == 200, _response.body && _response.body.IsSuccess) {


                    var profile;
                    if (_response.body.Result && _response.body.Result.profile_id) {

                        profile = _response.body.Result.profile_id;
                    }


                    return cb(null, profile);

                } else {

                    logger.error("There is an error in  create engagements for this session " + payload.jit);
                    //done(new Error('engagement_failed'));
                    return cb(_error,null);


                }
            }
            catch (excep) {

                cb(excep);

            }
        });
    } else {
        return cb(new Error('missing_config'));
    }
};

module.exports.DecryptMessages = function (messages) {

    try {
       return messages.map(function (item) {
            item.data = crypto_handler.Decrypt(item.data);
            return item;
        })
    } catch (ex) {
        console.error(ex);
        return messages;
    }
};

module.exports.http_post = function (serviceUrl,postData,tenant,company) {

    var jsonStr = JSON.stringify(postData);
    var accessToken = util.format("bearer %s", config.Host.token);
    console.log('HTTP POST Request:: %s', serviceUrl);
    var options = {
        url: serviceUrl,
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'authorization': accessToken,
            'companyinfo': util.format("%d:%d", tenant,company)
        },
        body: jsonStr
    };

    return new Promise(function (fulfill, reject) {
       request.post(options, function optionalCallback(err, httpResponse, body) {
            if (err) {
                console.log('upload failed:', err);
                reject(null);
            }
            else if(httpResponse.statusCode === 200){
                fulfill(body)
            }
            else {
                reject(null);
            }
        });
    });

    /*return   request.post(options, function optionalCallback(err, httpResponse, body) {
        if (err) {
            console.log('upload failed:', err);
            return null;
        }
        else if(httpResponse.statusCode === 200){
            return body;
        }
        else {
            return null;
        }
    });*/

};

