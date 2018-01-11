let is_running = 1;
let admin_i = 0, admin_pm = false, whitelist = false, i = 0, acct_whitelist = "";
let config = require('./config');
let fetch = require('node-fetch');
let request = require('request');

if (!config.domain || !config.token ||
    !config.bot_id || !config.bot_admin) {
    console.log("ERROR!:config情報が不足しています！");
    process.exit();
}

let WebSocketClient = require('websocket').client;
let client = new WebSocketClient();

client.on('connectFailed', function(error) {
    console.log('Connect Error: ' + error.toString());
});

client.on('connect', function(connection) {
    console.log('WebSocket Client Connected');
    connection.on('error', function(error) {
        console.log("Connection Error: " + error.toString());
    });
    connection.on('close', function() {
        console.log('AkariBot Connection Closed');
        //鯖落ち
    });
    connection.on('message', function(message) {
        //console.log(message);
        try {
            if (message.type === 'utf8') {
                let json = JSON.parse(JSON.parse(message.utf8Data).payload);
                if (json['account']) {
                    let acct = json['account']['acct'];
                    let text = json['content'];
                    if (acct !== config.bot_id) {
                        if (is_running) {
                            //終了
                            if (text.match(/!stop/i)) {
                                admin_i = 0;
                                admin_pm = false;

                                while (config.bot_admin[admin_i]) {
                                    if (acct === config.bot_admin[admin_i]) admin_pm = true;
                                    admin_i++;
                                }

                                if (admin_pm) {
                                    if (acct !== config.bot_admin[0]) {
                                        post("@"+acct+" @"+config.bot_admin[0]+" 終了しました。", {}, "direct");
                                    }
                                    change_running(0);
                                    console.log("OK:STOP:@"+acct);
                                }
                            }

                            if (json['media_attachments'][0] && !json['sensitive']) {
                                if (json['media_attachments'][0]["type"] === "image") {
                                    i = 0;
                                    whitelist = false;
                                    acct_whitelist = "";

                                    if (!acct.match(/@/i)) {
                                        acct_whitelist = acct + "@" + config.domain;
                                    } else {
                                        acct_whitelist = acct;
                                    }
                                    if (config.whitelist.match(new RegExp(acct_whitelist, 'i'))) {
                                        whitelist = true;
                                    }

                                    if (!whitelist) {
                                        checkImage(json);
                                    }
                                }
                            }
                        } else {
                            if (acct === config.bot_admin[0]) {
                                if (text.match(/!start/i)) {
                                    change_running(1);
                                    post("@"+ config.bot_admin[0] +" 起動しました。", {}, "direct");
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
        	post("@"+ config.bot_admin[0] +" 【エラー検知】\n\n"+ e, {}, "direct");
            change_running(0);
        }
    });
});

client.connect("wss://" + config.domain + "/api/v1/streaming/?access_token=" + config.token + "&stream=public");


// ここからいろいろ

function post(value, option = {}, visibility = "public", force) {
    var optiondata = {
        status: value,
        visibility: visibility
    };

    if (option.cw) {
        optiondata.spoiler_text = option.cw;
    }
    if (option.in_reply_to_id) {
        optiondata.in_reply_to_id = option.in_reply_to_id;
    }
    if (is_running || force) {
        fetch("https://" + config.domain + "/api/v1/statuses", {
            headers: {'Authorization': 'Bearer '+config.token},
            method: 'POST',
            body: JSON.stringify(optiondata)
        }).then(function(response) {
            if(response.ok) {
                return response.json();
            } else {
                throw new Error();
            }
        }).then(function(json) {
            if (json["id"]) {
                console.log("OK:POST");
            } else {
                console.warn("NG:POST:"+json);
            }
        }).catch(function(error) {
            console.warn("NG:POST:SERVER"+error);
        });
    }
}

function checkImage(data) {
    request.post({
        url: 'http://localhost:8080',
        formData: {
            'url': data['media_attachments'][0]["preview_url"],
        }
    }, function callback(err, httpResponse, body) {
        if (err) {
            console.error('request failed:', err);
            return;
        }
        let response = JSON.parse(body);
        console.log(response);
        if (response['output']['nsfw_score'] >= 0.8) {
            post("検知レベル: " + response['output']['nsfw_score'], {in_reply_to_id: data['id']}, "direct");
        }
    });
}

function change_running(mode) {
    if (mode === 1) {
        is_running = 1;
        console.log("OK:START");
    } else {
        is_running = 0;
        console.log("OK:STOP");
    }
}