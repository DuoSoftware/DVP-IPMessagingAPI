/**
 * Created by Rajinda on 5/13/2019.
 */

var restify = require('restify');
var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');

var config = require('config');

var port = config.Host.port || 3000;
var version = config.Host.version;
var socket_connect_handler = require('./Workers/socket_connect_handler');
var ards = require('./Workers/Ards');
var chat_handler = require('./Workers/chat_handler');

//-------------------------  Restify Server ------------------------- \\
var RestServer = restify.createServer({
    name: "ResourceService",
    version: '1.0.0'
}, function (req, res) {

});
restify.CORS.ALLOW_HEADERS.push('api_key');
restify.CORS.ALLOW_HEADERS.push('authorization');

RestServer.use(restify.CORS());
RestServer.use(restify.fullResponse());
//Enable request body parsing(access)
RestServer.use(restify.bodyParser());
RestServer.use(restify.acceptParser(RestServer.acceptable));
RestServer.use(restify.queryParser());

// ---------------- Security -------------------------- \\
var jwt = require('restify-jwt');
var secret = require('dvp-common/Authentication/Secret.js');
var authorization = require('dvp-common/Authentication/Authorization.js');
RestServer.use(jwt({secret: secret.Secret}));
// ---------------- Security -------------------------- \\

//Server listen
RestServer.listen(port, function () {
    console.log('%s listening at %s', RestServer.name, RestServer.url);


});

//------------------------- End Restify Server ------------------------- \\

RestServer.post('/DVP/API/' + version + '/IPMessengerAPI/Chats', authorization({
    resource: "attribute",
    action: "write"
}), chat_handler.register_chat_api_client);

RestServer.get('/DVP/API/' + version + '/IPMessengerAPI/Chats', authorization({
    resource: "attribute",
    action: "write"
}), chat_handler.long_term_token);


RestServer.post('/DVP/API/' + version + '/IPMessengerAPI/Chat/:CustomerID', authorization({
    resource: "attribute",
    action: "write"
}), chat_handler.initialize_chat);

RestServer.put('/DVP/API/' + version + '/IPMessengerAPI/Chat/Session/:SessionID/:AgentID', authorization({
    resource: "attribute",
    action: "write"
}), chat_handler.send_message_to_agent);

RestServer.del('/DVP/API/' + version + '/IPMessengerAPI/Chat/Session/:SessionID/:AgentID', authorization({
    resource: "attribute",
    action: "write"
}), chat_handler.end_chat);

/*
RestServer.put('/DVP/API/' + version + '/IPMessengerAPI/Chat', authorization({
    resource: "attribute",
    action: "write"
}), function (req, res, next) {

    return next();
});

RestServer.del('/DVP/API/' + version + '/IPMessengerAPI/Chat', authorization({
    resource: "attribute",
    action: "delete"
}), function (req, res, next) {

    return next();
});

RestServer.get('/DVP/API/' + version + '/IPMessengerAPI/Chat', authorization({
    resource: "attribute",
    action: "read"
}), function (req, res, next) {

    return next();
});
*/


RestServer.post('/DVP/API/' + version + '/IPMessengerAPI/ARDS', authorization({
    resource: "attribute",
    action: "write"
}), chat_handler.agent_found);

RestServer.post('/DVP/API/' + version + '/IPMessengerAPI/ARDS/QueuePosition', authorization({
    resource: "attribute",
    action: "write"
}), function (req, res, next) {
    console.info("------------------------------------------ ***  Queue Position Update  ****** -----------------------------");
    chat_handler.message_back_to_client(req,res);
    return next();
});

RestServer.post('/DVP/API/' + version + '/IPMessengerAPI/Massage/:CustomerID', authorization({
    resource: "attribute",
    action: "write"
}), chat_handler.message_back_to_client);

socket_connect_handler.initialize_socket(RestServer);
ards.RegisterChatArdsClient();


//------------------------- Crossdomain ------------------------- \\

function Crossdomain(req, res, next) {


    var xml = '<?xml version=""1.0""?><!DOCTYPE cross-domain-policy SYSTEM ""http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd""> <cross-domain-policy>    <allow-access-from domain=""*"" />        </cross-domain-policy>';

    /*var xml='<?xml version="1.0"?>\n';

     xml+= '<!DOCTYPE cross-domain-policy SYSTEM "/xml/dtds/cross-domain-policy.dtd">\n';
     xml+='';
     xml+=' \n';
     xml+='\n';
     xml+='';*/
    req.setEncoding('utf8');
    res.end(xml);

}

function Clientaccesspolicy(req, res, next) {


    var xml = '<?xml version="1.0" encoding="utf-8" ?>       <access-policy>        <cross-domain-access>        <policy>        <allow-from http-request-headers="*" http-methods="*">        <domain uri="*"/>        </allow-from>        <grant-to>        <resource include-subpaths="true" path="/"/>        </grant-to>        </policy>        </cross-domain-access>        </access-policy>';
    req.setEncoding('utf8');
    res.end(xml);

}

RestServer.get("/crossdomain.xml", Crossdomain);
RestServer.get("/clientaccesspolicy.xml", Clientaccesspolicy);

//------------------------- End Crossdomain ------------------------- \\