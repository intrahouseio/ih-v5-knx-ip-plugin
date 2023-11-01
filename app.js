/**
 * app.js
 */
const util = require('util');
const knx = require('knx');
const DPTLib = require('./node_modules/knx/src/dptlib');

module.exports = async function (plugin) {
    (async () => {
        plugin.log('Plugin KNX has started.', 0);
        process.send({ type: 'procinfo', data: { connection: 0 } });
        let toRead = [];
        let toReadOnStart = [];
        let toWrite = [];

        try {
            function delay(ms) {
                return new Promise(resolve => setTimeout(resolve, ms));
            }

            function dptconvert(buf, dptToConvert) {
                let dptresolve = DPTLib.resolve(dptToConvert);
                let convertvalue = DPTLib.fromBuffer(buf, dptresolve);
                plugin.log("Resolve DPT value: " + convertvalue, 1);
                return convertvalue
            }

            //KNX connection
            const connection = knx.Connection({
                ipAddr: plugin.params.data.host,
                ipPort: Number(plugin.params.data.port),
                loglevel: 'debug',
                suppress_ack_ldatareq: false,

                handlers: {
                    connected: function () {
                        plugin.log('Connected to KNX gateway!', 1);
                        plugin.log("Read on start channels...", 1)
                        process.send({ type: 'procinfo', data: { connection: 1 } });
                        toReadOnStart.forEach(function (chtoread) {
                            connection.read(chtoread.address, (src, responsevalue) => {
                                readvalue = Number(responsevalue.toString('hex'))
                                plugin.sendData([{ id: chtoread.id, value: readvalue }])
                            });
                            //delay(10);
                        });
                    },
                    event: function (evt, src, dest, value) {
                        let eventchannel = toRead.find(item => item.address == dest)
                        if (eventchannel !== undefined) {
                            eventvalue = dptconvert(value, eventchannel.dpt);
                            plugin.sendData([{ id: eventchannel.id, value: eventvalue }])
                        }
                        else {
                            eventvalue = util.inspect(value);
                        }
                        plugin.log("KNX EVENT:" + evt + " src:" + src + " dest:" + dest + " value:" + eventvalue, 1);
                    },
                     error: function(connstatus) {
                       process.send({ type: 'procinfo', data: { connection: 0 } });
                       plugin.log("ERROR: " + connstatus, 1);
                    }
                }
            });

            async function handleChanels() {
                plugin.channels.data.forEach(function (ch) {
                    if (ch.r == 1) {
                        toRead.push(ch);
                    }
                    if (ch.rs == 1) {
                        toReadOnStart.push(ch);
                    }
                });

            }

            await handleChanels();

            //Handle plugin commands
            plugin.onAct(message => {
                plugin.log('Get channel message: ' + util.inspect(message.data), 1);
                message.data.forEach(item => {
                    const msg = message.data[0]
                    let addressToWrite = msg.address
                    if (msg.diffw == 1) { addressToWrite = msg.waddress }
                    if (typeof JSON.parse(msg.value) === 'object') {
                      //plugin.log('Object type data...', 2)
                      connection.write(addressToWrite, JSON.parse(msg.value), "DPT" + msg.dpt);
                      plugin.log('Write to KNX - GA: ' + addressToWrite + ' Value:' + JSON.parse(msg.value) +  " DPT" + msg.dpt, 1)
                    }
                    else {
                      if (/4./gm.test(msg.dpt) || /10./gm.test(msg.dpt) || /11./gm.test(msg.dpt) || /16./gm.test(msg.dpt)) {
                        //plugin.log('String type data...', 2)
                        connection.write(addressToWrite, String(msg.value), "DPT" + msg.dpt);
                        plugin.log('Write to KNX - GA: ' + addressToWrite + ' Value:' + String(msg.value) +  " DPT" + msg.dpt, 1)
                      }
                      else {
                        //plugin.log('Number type data...', 2)
                        connection.write(addressToWrite, Number(msg.value), "DPT" + msg.dpt);
                        plugin.log('Write to KNX - GA: ' + addressToWrite + ' Value:' + Number(msg.value) +  " DPT" + msg.dpt, 1)
                      }
                    }
                })
            });

        } catch (err) {
            plugin.exit(8, util.inspect(err));
        }
    })();
}

