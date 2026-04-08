const convert = require('xml-js');

module.exports = {
    async uploadXml(unit, indata, holder) {
        const channels = this.chano.charr;
        const channelsmap = await indexChannels(channels);
        const pluginparams = this.doc;
        const updateAllChannels = pluginparams.importUpdateAll || 0;
        const rsReagexps = pluginparams.importRSregex.split(',')
        const userOptions = {
            r: pluginparams.importR,  //SET ALL CHANNELS TO READ
            rs: pluginparams.importRS, //SER ALL CHANNELS TO READ ON START PLUGIN
            w: pluginparams.importW   //SET ALL CHANNELS TO WRITE
        }
        let chanArray = []
        let etsdata = convert.xml2json(indata, { ignoreComment: true, alwaysChildren: true });
        etsdata = JSON.parse(etsdata)
        let mainGA = etsdata.elements[0].elements
        let orderFirst = 0;
        let orderSecond = 0;
        let orderGA = 0;
        let updateChCnt = 0;

        async function indexChannels(channels) {
            return channels.reduce((index, ch) => {
                const key = ch.chanId;
                if (!key) { return index }
                index[key] = ch;
                return index;
            }, {});
        }

        mainGA.forEach(function (main) { //FIRST BYTE GA
            let rootFolder = main.attributes.Name
            let rootIndex = main.attributes.RangeStart
            console.log(rootFolder)
            chanArray.push(({ id: unit + "_" + rootFolder + "_" + rootIndex, title: rootFolder, folder: 1, order: orderFirst++ }))


            main.elements.forEach(function (mid) {  //SECOND BYTE GA
                let midFolder = mid.attributes.Name
                let midIndex = mid.attributes.RangeStart / 256

                console.log("  " + midFolder)
                chanArray.push(({ id: unit + "_" + midFolder + "_" + midIndex, title: midFolder, parent: unit + "_" + rootFolder + "_" + rootIndex, folder: 1, order: orderSecond++ }))

                mid.elements.forEach(function (ga) { //GA
                    let gaFolder = ga.attributes.Name
                    console.log("    " + gaFolder)

                    let chid = ''
                    let address = ga.attributes["Address"]
                    let dpt = '1.001'
                    let isRS = 0
                    if (ga["attributes"].hasOwnProperty("Name")) {
                        chid = ga.attributes["Name"]
                    }
                    else {
                        chid = ga.attributes["Address"]
                    }
                    if (ga["attributes"].hasOwnProperty("DPTs")) {
                        let dptxml = ga.attributes["DPTs"].split('-')
                        dpt = dptxml[1] + '.' + dptxml[1].padStart(3, '0');
                    }


                    if (userOptions.rs == 1) {
                        isRS = 1
                    }
                    else {
                        rsReagexps.forEach(rgex => {
                            const regex = new RegExp(rgex);
                            if (regex.test(ga.attributes["Name"])) { isRS = 1 }
                        });
                    }

                    const chanId = unit + "_" + address.replaceAll('/', '_');
                    const alreadyHasChan = channelsmap[chanId];
                    const needtoupdate = updateAllChannels || !alreadyHasChan;
                    const channel = {
                        id: chanId,
                        name: needtoupdate ? chid : alreadyHasChan.chid,
                        address: needtoupdate ? address : alreadyHasChan.address,
                        dpt: needtoupdate ? dpt : alreadyHasChan.dpt,
                        r: needtoupdate ? (userOptions.r == 1 ? 1 : 0) : alreadyHasChan.r,
                        rs: needtoupdate ? isRS : alreadyHasChan.rs,
                        w: needtoupdate ? (userOptions.w == 1 ? 1 : 0) : alreadyHasChan.w,
                        parent: needtoupdate ? `${unit}_${midFolder}_${midIndex}` : alreadyHasChan.parent,
                        order: orderGA++
                    }

                    if (needtoupdate) updateChCnt++;
                    if (chanArray.length > 0) chanArray.push(channel);
                })

            })
        })

        holder.emit('debug', 'plugin_' + this.id, "Update channels:" + updateChCnt)
        holder.emit('receive:plugin:channels', { unit, data: chanArray });
        return { response: 1 };
    }
};
