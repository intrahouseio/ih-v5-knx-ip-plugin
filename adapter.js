const convert = require('xml-js');

module.exports = {
    async uploadXml(unit, indata, holder) {
        const userOptions = {
            r: 1,  //SET ALL CHANNELS TO READ
            rs: 1, //SER ALL CHANNELS TO READ ON START PLUGIN
            w: 1   //SET ALL CHANNELS TO WRITE
        }
        let chanArray = []
        let etsdata = convert.xml2json(indata, { ignoreComment: true, alwaysChildren: true });
        etsdata = JSON.parse(etsdata)
        let mainGA = etsdata.elements[0].elements

        mainGA.forEach(function (main) { //FIRST BYTE GA
            let rootFolder = main.attributes.Name
            let rootIndex = main.attributes.RangeStart
            console.log(rootFolder)
            chanArray.push(({ id: unit + "_" + rootFolder + "_" + rootIndex, title: rootFolder, folder: 1 }))


            main.elements.forEach(function (mid) {  //SECOND BYTE GA
                let midFolder = mid.attributes.Name
                let midIndex = mid.attributes.RangeStart / 256

                console.log("  " + midFolder)
                chanArray.push(({ id: unit + "_" + midFolder + "_" + midIndex, title: midFolder, parent: unit + "_" + rootFolder + "_" + rootIndex, folder: 1 }))


                mid.elements.forEach(function (ga) { //GA
                    let gaFolder = ga.attributes.Name
                    console.log("    " + gaFolder)

                    let chid = ''
                    let address = ga.attributes["Address"]
                    let dpt = '1.001'
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
                    chanArray.push({
                        id: unit + "_" + address.replaceAll('/', '_'),
                        name: chid,
                        address: address,
                        dpt: dpt,
                        r: userOptions.r == 1 ? 1 : 0,
                        rs: userOptions.rs == 1 ? 1 : 0,
                        w: userOptions.w == 1 ? 1 : 0,
                        parent: unit + "_" + midFolder + "_" + midIndex
                    });

                })

            })
        })
        holder.emit('receive:plugin:channels', { unit, data: chanArray });
        return { response: 1 };
    }
};
