function kicadPcbToJson(pcb) {
    function _split(line) {
        let parts = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') {
                inQuotes = !inQuotes;
                current += line[i];
            } else if (line[i] === ' ' && !inQuotes) {
                if (current) {
                    parts.push(current);
                    current = '';
                }
            } else {
                current += line[i];
            }
        }

        if (current) {
            parts.push(current);
        }

        return parts;
    }

    let json = {};
    let node = [json];
    for (let line of pcb.split('\n')) {
        line = line.trim();
        // start of section
        if (line.startsWith("(") && line.endsWith(")") === false) {
            line = line.replace(/^\(|\)$/g, '');
            const parts = _split(line);
            //console.log(parts);
            if (parts.length === 1) {
                const newNode = {};
                node[node.length - 1][parts[0]] = newNode;
                node.push(newNode);
            } else if (parts.length === 2 && parts[0] === "layer") { // handle for layer items in (stackup
                //console.log(parts);
                if (!("layer" in node[node.length - 1])) {
                    const newNode = [];
                    node[node.length - 1]["layer"] = newNode;
                    node.push(newNode);
                } else {
                    node.push(node[node.length - 1]["layer"]);
                }
                const newNode = {};
                node[node.length - 1].push({ [parts[1]]: newNode });
                node.push(newNode);
            } else if (parts.length === 3 && parts[2] === "addsublayer") { // handle for layer items in (stackup with addsublayer parameter
                //console.log("addsublayer");
                node[node.length - 1][parts[0]] = parts[1].replace(/^\(|\)$/g, '');
                if ("sublayer" in node[node.length - 3]) {
                    node.pop();
                } else if (!("sublayer" in node[node.length - 1])) {
                    const newNode = [];
                    node[node.length - 1]["sublayer"] = newNode;
                    node.push(newNode);
                } else {
                    node.push(node[node.length - 1]["sublayer"]);
                }
                const newNode = {};
                node[node.length - 1].push(newNode);
                node.push(newNode);
            } else {
                console.log("Error parsing line:", line);
            }
        } else if (line.startsWith("(") === false && line.endsWith(")")) {
            //console.log("pop");
            node.pop();
            if (node.length > 1 &&
                "sublayer" in node[node.length - 2] &&
                node[node.length - 2]["sublayer"] === node[node.length - 1]) {
                //console.log("pop sublayer");
                node.pop();
                node.pop();
            }
            if (node.length > 1 &&
                "layer" in node[node.length - 2] &&
                node[node.length - 2]["layer"] === node[node.length - 1]) {
                //console.log("pop layer");
                node.pop();
            }
        } else if (line.startsWith("(") && line.endsWith(")")) {
            line = line.replace(/^\(|\)$/g, '');
            const parts = _split(line);
            if (parts[0] === "net") {
                ;
            } else if (parts.length === 2) {
                node[node.length - 1][parts[0]] = parts[1];
            } else if (parts.length > 2) { // handline for items in (layers
                node[node.length - 1][parts[0]] = parts.slice(1);
            } else {
                console.log("Error parsing line:", line);
            }
        } else if (line === "") {
            ;
        } else {
            console.log("Error parsing line:", line);
        }
    }
    return json;
}

registerEda("kicad", (data) => {
    return new Promise((resolve, reject) => {
        console.log("KiCad encode");

        function _jsonToKicadPcb(json, indent) {
            let pcb = "";
            for (let key in json) {
                if (key === "layers") {
                    pcb += " ".repeat(indent) + "(" + key + "\n";
                    for (k in json[key]) {
                        pcb += " ".repeat(indent + 1) + "(" + k;
                        for (i = 0; i < json[key][k].length; i++) {
                            pcb += " " + json[key][k][i];
                        }
                        pcb += ")\n";
                    }
                    pcb += " ".repeat(indent) + ")" + "\n";
                } else if (key === "layer") {
                    for (i = 0; i < json[key].length; i++) {
                        pcb += " ".repeat(indent + 1) + "(" + key;
                        for (k in json[key][i]) {
                            pcb += " " + k;
                            for (j in json[key][i][k]) {
                                if (j === "sublayer") {
                                    for (l = 0; l < json[key][i][k][j].length; l++) {
                                        pcb += " addsublayer";
                                        for (m in json[key][i][k][j][l]) {
                                            pcb += "\n" + " ".repeat(indent + 2) + "(" + m + " " + json[key][i][k][j][l][m] + ")";
                                        }
                                    }
                                } else {
                                    pcb += "\n" + " ".repeat(indent + 2) + "(" + j + " " + json[key][i][k][j] + ")";
                                }
                            }
                            pcb += "\n";
                        }
                        pcb += " ".repeat(indent + 1) + ")" + "\n";
                    }
                } else {
                    pcb += " ".repeat(indent) + "(" + key;
                    if (typeof json[key] === "string") {
                        pcb += " " + json[key] + ")\n";
                    } else if (typeof json[key] === "object") {
                        pcb += "\n";
                        pcb += _jsonToKicadPcb(json[key], indent + 1);
                        pcb += " ".repeat(indent) + ")\n";
                    }
                }
            }
            return pcb;
        }

        function jsonToKicadPcb(json) {
            let pcb = _jsonToKicadPcb(json, 0);
            return pcb;
        }

        const fetchFiles = [
            browser.runtime.getURL('edas/kicad/res/template.kicad_pcb'),
            browser.runtime.getURL('edas/kicad/res/template.kicad_pro'),
            browser.runtime.getURL('edas/kicad/res/template.kicad_dru')
        ];

        Promise.all(fetchFiles.map(url => fetch(url).then(response => response.text())))
            .then(([kicad_pcb, kicad_pro, kicad_dru]) => {
                console.log(data);

                // pro file
                {
                    pro = JSON.parse(kicad_pro);

                    pro.board.design_settings.rules.min_through_hole_diameter = data.pro.board.design_settings.rules.min_through_hole_diameter;
                    pro.board.design_settings.rules.min_via_annular_width = data.pro.board.design_settings.rules.min_via_annular_width;
                    pro.board.design_settings.rules.min_via_diameter = data.pro.board.design_settings.rules.min_via_diameter;

                    pro.board.design_settings.rules.min_track_width = data.pro.board.design_settings.rules.min_track_width;
                    pro.board.design_settings.rules.min_connection = data.pro.board.design_settings.rules.min_connection;
                    pro.board.design_settings.rules.min_clearance = data.pro.board.design_settings.rules.min_clearance;
                    pro.board.design_settings.rules.min_hole_clearance = data.pro.board.design_settings.rules.min_hole_clearance;
                    pro.board.design_settings.rules.min_copper_edge_clearance = data.pro.board.design_settings.rules.min_copper_edge_clearance;
                    pro.board.design_settings.rules.min_hole_to_hole = data.pro.board.design_settings.rules.min_hole_to_hole;
                    pro.board.design_settings.rules.min_microvia_diameter = data.pro.board.design_settings.rules.min_microvia_diameter;
                    pro.board.design_settings.rules.min_microvia_drill = data.pro.board.design_settings.rules.min_microvia_drill;

                    pro.board.design_settings.defaults.silk_line_width = data.pro.board.design_settings.defaults.silk_line_width;
                    pro.board.design_settings.defaults.silk_text_size_h = data.pro.board.design_settings.defaults.silk_text_size_h;
                    pro.board.design_settings.defaults.silk_text_size_v = data.pro.board.design_settings.defaults.silk_text_size_v;
                    pro.board.design_settings.defaults.silk_text_thickness = data.pro.board.design_settings.defaults.silk_text_thickness;
                    
                    pro.board.design_settings.defaults.copper_line_width = data.pro.board.design_settings.defaults.copper_line_width;
                    pro.board.design_settings.defaults.copper_text_size_h = data.pro.board.design_settings.defaults.copper_text_size_h;
                    pro.board.design_settings.defaults.copper_text_size_v = data.pro.board.design_settings.defaults.copper_text_size_v;
                    pro.board.design_settings.defaults.copper_text_thickness = data.pro.board.design_settings.defaults.copper_text_thickness;

                    pro.board.design_settings.rules.min_text_thickness = data.pro.board.design_settings.rules.min_text_thickness;
                    pro.board.design_settings.rules.min_silk_clearance = data.pro.board.design_settings.rules.min_silk_clearance;
                    pro.board.design_settings.rules.min_text_height = data.pro.board.design_settings.rules.min_text_height;

                    kicad_pro = JSON.stringify(pro, null, 2);
                }

                // pcb file
                {
                    pcb = kicadPcbToJson(kicad_pcb);
                    for (let i = 0; i <= 31; i++) {
                        if (i in data.pcb.layers) {
                            pcb.kicad_pcb.layers[i] = data.pcb.layers[i];
                        } else {
                            delete pcb.kicad_pcb.layers[i];
                        }
                    }

                    pcb.kicad_pcb.setup.stackup.copper_finish = data.pcb.setup.stackup.copper_finish;
                    pcb.kicad_pcb.setup.stackup.layer = data.pcb.setup.stackup.layer;
                    pcb.kicad_pcb.setup.stackup.edge_plating = data.pcb.setup.stackup.edge_plating;
                    pcb.kicad_pcb.setup.stackup.edge_connector = data.pcb.setup.stackup.edge_connector;

                    pcb.kicad_pcb.setup.solder_mask_min_width = data.pcb.setup.solder_mask_min_width;

                    kicad_pcb = jsonToKicadPcb(pcb);
                }

                // dru file
                {
                    dru = kicad_dru;

                    dru = data.dru;

                    kicad_dru = dru;
                }

                if (0) {
                    const pcbBlob = new Blob([kicad_pcb], { type: 'text/plain' });
                    const pcbUrl = URL.createObjectURL(pcbBlob);
                    const pcbLink = document.createElement('a');
                    pcbLink.href = pcbUrl;
                    pcbLink.download = "kicad_rules.kicad_pcb";
                    document.body.appendChild(pcbLink);
                    pcbLink.click();
                    document.body.removeChild(pcbLink);
                    URL.revokeObjectURL(pcbUrl);
                } else {
                    const zip = new JSZip();
                    zip.file("kicad_rules.kicad_pcb", kicad_pcb);
                    zip.file("kicad_rules.kicad_pro", kicad_pro);
                    zip.file("kicad_rules.kicad_dru", kicad_dru);
                    for (const key in data.log.raw) {
                        zip.file("log/" + key, data.log.raw[key]);
                    }

                    zip.generateAsync({ type: "blob" }).then(function (content) {
                        const url = URL.createObjectURL(content);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = "kicad_rules.zip";
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    });
                }

                resolve({}); // todo: resolve warnings and errors
            })
            .catch(error => {
                console.error('Error fetching files:', error);
            });
    });
});
