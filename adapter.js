const convert = require('xml-js');
//const util = require('util'); //for debug adapter
//const fs = require('fs') //for debug adapter

module.exports = {
    async uploadXml(unit, indata, holder) {
        let toFile = ''
        let chanArray = []
        console.log('uploadXml data=' + indata);
        let etsdata = convert.xml2json(indata, { ignoreComment: true, alwaysChildren: true });
        etsdata = JSON.parse(etsdata)
        let arrGA = etsdata.elements[0].elements[0].elements[0].elements
        arrGA.forEach(function (elem) {
            let chid = ''
            let address = elem.attributes["Address"]
            let dpt = '1.001'
            if (elem["attributes"].hasOwnProperty("Name")){
                chid = elem.attributes["Name"]
            }
            else {
                chid = elem.attributes["Address"]
            }
            if (elem["attributes"].hasOwnProperty("DPTs")) {
                let dptxml = elem.attributes["DPTs"].split('-')
                dpt = dptxml[1] + '.' + dptxml[1].padStart(3, '0');
            }
            chanArray.push({
                id: chid,
                chan: chid,
                address: address,
                dpt: dpt,
                r: 1
              });
            //toFile += (chid + " / " + address + " / " + dpt + '\n') //for debug adapter
        })
        //fs.writeFileSync("/var/lib/ih-v5/plugins/knxip/importets.txt", toFile) //for debug adapter
        holder.emit('receive:plugin:channels', { unit, data: chanArray });
        return { response: 1 };
    }
};