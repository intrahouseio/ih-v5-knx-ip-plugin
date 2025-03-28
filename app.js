/**
 * app.js
 */
const util = require('util');
const knx = require('knx');
const DPTLib = require('./node_modules/knx/src/dptlib');

module.exports = async function (plugin) {
    const host = plugin.params.host;
    const port = plugin.params.port;
    const intrface = plugin.params.intrface;
    const physAddr = plugin.params.physAddr;
    const reqdelay = plugin.params.reqdelay || 20;
    const reqtimeout = plugin.params.reqtimeout || 200;
    const manualConnect = 0;
    const forceTunneling = plugin.params.forceTunneling == 1 ? true : false;
    const minimumDelay = 0;
    const suppress_ack_ldatareq = plugin.params.suppress_ack_ldatareq == 1 ? true : false;
    const localEchoInTunneling = plugin.params.localEchoInTunneling == 1 ? true : false;
    const rsEnable = plugin.params.rsEnable == 1 ? true : false;


    (async () => {
        process.send({ type: 'procinfo', data: { connection: 0 } });

        let isConnected = false;
        let toRead = [];
        let toReadOnStart = [];
        let rsBuffer = [];
        let rsFlag = 0;
        let lastSend = performance.now;
        let isProcessing = false;
        const queue = [];

        try {
            function delay(ms) {
                return new Promise(resolve => setTimeout(resolve, ms));
            }

            function dptconvert(buf, dptToConvert) {
                let dptresolve = DPTLib.resolve(dptToConvert);
                let convertvalue = DPTLib.fromBuffer(buf, dptresolve);
                //plugin.log("Resolve DPT value: " + convertvalue, 1);
                return convertvalue;
            }

            function knxWrite(msg) {
                let addressToWrite = msg.address;
                if (msg.diffw == 1) { addressToWrite = msg.waddress }
                if (typeof JSON.parse(msg.value) === 'object') {
                    connection.write(addressToWrite, JSON.parse(msg.value), "DPT" + msg.dpt);
                    plugin.log('Write to KNX - GA: ' + addressToWrite + ' Value:' + JSON.parse(msg.value) + " DPT" + msg.dpt, 1);
                } else {
                    if (/4./gm.test(msg.dpt) || /10./gm.test(msg.dpt) || /11./gm.test(msg.dpt) || /16./gm.test(msg.dpt)) {
                        connection.write(addressToWrite, String(msg.value), "DPT" + msg.dpt);
                        plugin.log('Write to KNX - GA: ' + addressToWrite + ' Value:' + String(msg.value) + " DPT" + msg.dpt, 1);
                    } else {
                        connection.write(addressToWrite, Number(msg.value), "DPT" + msg.dpt);
                        plugin.log('Write to KNX - GA: ' + addressToWrite + ' Value:' + Number(msg.value) + " DPT" + msg.dpt, 1);
                    }
                }
            }

            async function knxRead(address) {
                try {
                    plugin.log(`Read address: ${address}`, 1);
                    const result = await new Promise((resolve) => {
                        const timeout = setTimeout(() => {
                            plugin.log(`Timeout waiting for response from ${address}`, 1);
                            resolve("timeout");
                        }, reqtimeout);

                        connection.read(address, (src, responsevalue) => {
                            clearTimeout(timeout);
                            resolve(responsevalue);
                        });
                    });
                    return result;
                } catch (err) {
                    plugin.log(`Error reading ${address}: ${util.inspect(err)}`, 1);
                    return undefined;
                }
            }

            async function handleChanels() {
                plugin.channels.forEach(function (ch) {
                    if (ch.r == 1) {
                        toRead.push(ch);
                    }
                    if (ch.rs == 1) {
                        toReadOnStart.push(ch);
                    }
                });
                plugin.log(`Channels processed: ${toRead.length} to read, ${toReadOnStart.length} to read on start.`, 1);
            }

            async function readOnStart() {
                plugin.log("Read on start channels...", 1);
                rsFlag = 1;
                process.send({ type: 'procinfo', data: { readonstart: rsFlag } });

                let rsDataSend = setInterval(function () {
                    if (rsFlag && rsBuffer.length != 0) {
                        plugin.sendData(rsBuffer)
                        rsBuffer = []
                    }
                }, 1000);

                for await (const chtoread of toReadOnStart) {
                    await knxRead(chtoread.address);
                    await delay(reqdelay);
                }

                setTimeout(() => {
                    if (rsBuffer.length != 0) { plugin.sendData(rsBuffer) }
                    rsFlag = 0
                    clearInterval(rsDataSend)
                    plugin.log("Read on start completed.", 1);
                    process.send({ type: 'procinfo', data: { readonstart: rsFlag } });
                }, 500);
            }

            function disconnect() {
                connection.Disconnect(() => { plugin.log('Disconnected from KNX gateway!') });
                setTimeout(() => { process.exit(0) }, 500);
            }

            async function processQueue(message) {
                queue.push(message);

                if (isProcessing) return;
                isProcessing = true;

                while (queue.length > 0) {
                    const currentMessage = queue.shift();
                    for (const msg of currentMessage.data) {
                        const elapsed = performance.now() - lastSend;
                        let wrdelay = reqdelay - elapsed > 0 ? Math.max(reqdelay - elapsed, 50) : 0;
                        if (wrdelay > 0) {
                            plugin.log(`Waiting ${wrdelay} ms...`, 1);
                            await delay(wrdelay);
                        }
                        knxWrite(msg);
                        lastSend = performance.now();
                    }
                }
                isProcessing = false;
            }


            const connection = knx.Connection({
                loglevel: 'error',
                ipAddr: host,
                ipPort: Number(port),
                intrface: intrface,
                physAddr: physAddr,
                manualConnect: manualConnect,
                forceTunneling: forceTunneling,
                minimumDelay: minimumDelay,
                suppress_ack_ldatareq: suppress_ack_ldatareq,
                localEchoInTunneling: localEchoInTunneling,

                handlers: {
                    connected: async function () {
                        if (isConnected) {
                            plugin.log('Reconnection detected, skipping initialization.', 1);
                            return;
                        }

                        isConnected = true;
                        plugin.log('Connected to KNX gateway!');
                        process.send({ type: 'procinfo', data: { connection: 1 } });

                        await handleChanels();
                        if (rsEnable) {
                            await readOnStart();
                        }
                    },
                    event: function (evt, src, dest, value) {
                        let eventchannel = toRead.find(item => item.address == dest);
                        if (eventchannel !== undefined) {
                            eventvalue = dptconvert(value, eventchannel.dpt);
                            plugin.log("KNX EVENT:" + evt + " src:" + src + " dest:" + dest + " value:" + eventvalue, 1);
                            if (rsFlag) { rsBuffer.push({ id: eventchannel.id, value: eventvalue }) }
                            else { plugin.sendData([{ id: eventchannel.id, value: eventvalue }]) }
                        } else {
                            eventvalue = util.inspect(value);
                        }
                    },
                    error: function (connstatus) {
                        isConnected = false;
                        process.send({ type: 'procinfo', data: { connection: 0 } });
                        plugin.log("ERROR: " + connstatus);
                        plugin.exit(999, 'Error connection!');
                    }
                }
            });

            plugin.onAct(async (message) => {
                plugin.log('Get channel message: ' + util.inspect(message.data), 1);
                await processQueue(message); 
            });


            plugin.onCommand(async msg => {
                let result;
                if (msg.knxcmd == "write") {
                    if (!msg.address || !msg.dpt || msg.value === undefined) {
                        plugin.log("Invalid command!", 1);
                        return
                    }
                    const writedata = { address: msg.address, dpt: msg.dpt, value: msg.value }
                    knxWrite(writedata)
                    result = 1
                }
                if (msg.knxcmd == "read") {
                    if (!msg.address || !msg.dpt) {
                        plugin.log("Invalid command!", 1);
                        return
                    }
                    let resultBuffer = await knxRead(msg.address)
                    result = dptconvert(resultBuffer, msg.dpt);
                }
                const tosender = { result: result, type: 'command', unit: msg.unit, uuid: msg.uuid, sender: msg.sender };
                plugin.sendResponse(tosender, 1);
            });

            process.on('SIGTERM', () => { disconnect() });

        } catch (err) {
            plugin.exit(8, util.inspect(err));
        }
    })();
}
