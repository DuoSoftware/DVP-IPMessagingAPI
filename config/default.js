module.exports = {
    
  "Mongo": {
    "ip": "172.16.25.32",
    "port": "27017",
    "dbname": "facetone",
    "user": "duo",
    "password": "DuoS123",
    "type": "mongodb"
  },


    "Redis":
        {
            "mode":"instance",//instance, cluster, sentinel
            "ip": "172.16.25.32",
            "port": 6379,
            "user": "duo",
            "db": 2,
            "password": "DuoS123",
            "sentinels":{
                "hosts": "138.197.90.92,45.55.205.92,138.197.90.92",
                "port":16389,
                "name":"redis-cluster"
            }

        },
    "Security":
        {

            "ip" : "172.16.25.32",
            "port": 6379,
            "user": "duo",
            "password": "DuoS123",
            "mode":"instance",//instance, cluster, sentinel
            "sentinels":{
                "hosts": "138.197.90.92,45.55.205.92,138.197.90.92",
                "port":16389,
                "name":"redis-cluster"
            }
        },
    "Host":
        {
            "botclientusers":"ip_api_bot_online_users",
            "tokenduration":120, /*in secounds*/
            "longtermtokenduration":2592000, /*in secounds*/
            "vdomain": "localhost",
            "domain": "localhost",
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