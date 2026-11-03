module.exports = {
    
  "Mongo": {
    "ip": "",
    "port": "27017",
    "dbname": "facetone",
    "user": "",
    "password": "",
    "type": "mongodb"
  },


    "Redis":
        {
            "mode":"instance",//instance, cluster, sentinel
            "ip": "",
            "port": 6379,
            "db": 2,
            "password": "",
            "sentinels":{
                "hosts": "",
                "port":16389,
                "name":"redis-cluster"
            }

        },
    "Security":
        {

            "ip" : "",
            "port": 6379,
            "password": "",
            "mode":"instance",//instance, cluster, sentinel
            "sentinels":{
                "hosts": "",
                "port":16389,
                "name":"redis-cluster"
            }
        },
    "Host":
        {
            "botclientusers":"ip_api_bot_online_users",
            "tokenduration":120, /*in secounds*/
            "longtermtokenduration":2592000, /*in secounds*/
            "port": "3002",
            "version": "1.0.0.0",
            //"messenger": "user",
            "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJmcm9kb29kIiwianRpIjoiMDIxYzQ4MWEtNTUxMC00MzlkLTk1YjgtZWY5OTY3MmY1ZmFhIiwic3ViIjoiNTZhOWU3NTlmYjA3MTkwN2EwMDAwMDAxMjVkOWU4MGI1YzdjNGY5ODQ2NmY5MjExNzk2ZWJmNDMiLCJleHAiOjIzMzQxMjMzNjAsInRlbmFudCI6LTEsImNvbXBhbnkiOi0xLCJzY29wZSI6W3sicmVzb3VyY2UiOiJhbGwiLCJhY3Rpb25zIjoiYWxsIn1dLCJpYXQiOjE0NzAyMDk3NjB9.Wh-E2OVg6nwsicj9yQdx92js6rPg6pzkZkmwk69FHmc",
            "encryptedhex":"1, 12, 3, 4, 5, 16, 7, 8, 12, 10, 11, 12, 13, 14, 15, 16"// accept only 1-16

        },
    "Services": {
        "call_back_url": "ipmessagingapi.facetonelite.com",//ipmessagingapi.app.veery.cloud
        "call_back_url_port": '3002',
        "call_back_url_version":"1.0.0.0",

        "interactionurl": "interactions.facetonelite.com",//interactions.app.veery.cloud
        "interactionport": '3637',
        "interactionversion":"1.0.0.0",

        "ardsliteservice": "ardsliteservice.facetonelite.com",//ardsliteservice.app.veery.cloud
        "ardsliteport": "8828",
        "ardsliteversion": "1.0.0.0"
    }
};