registerService(
    "pcbway", // name
    "https://www.pcbway.com/Quote/GetDeliveryDays/", // url
    (details) => { // handler
        if (details.method === "POST" && details.requestBody) {
            function storeQuote(pcbway, quote) {
                pcbway.quoteDate = Date.now();
                pcbway.quoteData = quote;

                browser.storage.local.set({ pcbway }).then(() => {
                    console.log("PCBWAY data saved to local storage: " + Date.now());

                    let countdown = 100;
                    const iconInterval = setInterval(() => {
                        if (countdown <= 0) {
                            clearInterval(iconInterval);
                            browser.action.setIcon({ path: "res/icons/icon.png" });
                        } else {
                            browser.action.setIcon({ path: `services/pcbway/res/favicon/favicon_${countdown}.png` });
                            countdown -= 10;
                        }
                    }, 50);
                }), (error => {
                    console.error("Failed to save PCBWAY data to local storage: " + error);
                });
            }

            browser.storage.local.get('pcbway').then(result => {
                if (SHOW_QUOTE_CHANGES) {
                    console.log("PCBWAY data changes:");
                    compareObjects(result.pcbway.quoteData, details.requestBody.formData);
                }
                storeQuote(result.pcbway, details.requestBody.formData);
            }).catch(error => {
                storeQuote({}, details.requestBody.formData);
            });
        }
    },
    () => { // handler_status
        return new Promise((resolve, reject) => {
            browser.storage.local.get('pcbway').then(result => {
                let lastQuote = "N/A";
                if (result.pcbway.quoteDate != null) {
                    lastQuote = (new Date(result.pcbway.quoteDate)).toLocaleString();
                }
                let lastStackup = "N/A";
                if (result.pcbway.stackupDate != null) {
                    lastStackup = (new Date(result.pcbway.stackupDate)).toLocaleString();
                }
                let lastRules = "N/A";
                if (result.pcbway.rulesDate != null) {
                    lastRules = (new Date(result.pcbway.rulesDate)).toLocaleString();
                }
                let status = `Quote: ${lastQuote}\r\nStackup: ${lastStackup}\r\nRules: ${lastRules}`;
                resolve({ date: result.pcbway.quoteDate, message: status });
            }).catch(error => {
                resolve(null);
            });
        });
    },
    () => { // delete_cache
        return new Promise((resolve, reject) => {
            browser.storage.local.remove('pcbway').then(result => {
                console.log("PCBWAY data deleted from local storage");
                resolve(result);
            }).catch(error => {
                console.log("PCBWAY delete error: " + error);
                reject(error);
            });
        });
    },
    (json) => { // decoder
        return new Promise((resolve, reject) => {
            function decodeStep4(pcbway, stackup, kicad_dru, kicad_pcb, kicad_prl, kicad_pro, kicad_sch) {
                console.log("decodeStep4");

                pcb = kicadPcbToJson(kicad_pcb);
                pro = JSON.parse(kicad_pro);

                // default settings
                {
                    json.pcb.setup.stackup.layer = [
                        { "\"F.SilkS\"": { "type": "\"silk screen\"", "color": "\"white\"" } },
                        { "\"F.Paste\"": { "type": "\"solder paste\"" } },
                        { "\"F.Mask\"": { "type": "\"solder mask\"", "thickness": 0, "color": "\"green\"" } },
                        { "\"B.Mask\"": { "type": "\"solder mask\"", "thickness": 0, "color": "\"green\"" } },
                        { "\"B.Paste\"": { "type": "\"solder paste\"" } },
                        { "\"B.SilkS\"": { "type": "\"silk screen\"", "color": "\"white\"" } }
                    ];

                    json.pcb.setup.solder_mask_min_width = pcb.setup.solder_mask_min_width;

                    json.pro.board.design_settings.defaults.silk_line_width = pro.board.design_settings.defaults.silk_line_width;
                    json.pro.board.design_settings.defaults.silk_text_size_h = pro.board.design_settings.defaults.silk_text_size_h;
                    json.pro.board.design_settings.defaults.silk_text_size_v = pro.board.design_settings.defaults.silk_text_size_v;
                    json.pro.board.design_settings.defaults.silk_text_thickness = pro.board.design_settings.defaults.silk_text_thickness;

                    json.pro.board.design_settings.defaults.copper_line_width = pro.board.design_settings.defaults.copper_line_width;
                    json.pro.board.design_settings.defaults.copper_text_size_h = pro.board.design_settings.defaults.copper_text_size_h;
                    json.pro.board.design_settings.defaults.copper_text_size_v = pro.board.design_settings.defaults.copper_text_size_v;
                    json.pro.board.design_settings.defaults.copper_text_thickness = pro.board.design_settings.defaults.copper_text_thickness;

                    json.pro.board.design_settings.rules.min_hole_clearance = pro.board.design_settings.rules.min_hole_clearance;
                    json.pro.board.design_settings.rules.min_copper_edge_clearance = pro.board.design_settings.rules.min_copper_edge_clearance;
                    json.pro.board.design_settings.rules.min_hole_to_hole = pro.board.design_settings.rules.min_hole_to_hole;

                    json.pro.board.design_settings.rules.min_text_thickness = pro.board.design_settings.rules.min_text_thickness;
                    json.pro.board.design_settings.rules.min_silk_clearance = pro.board.design_settings.rules.min_silk_clearance;
                    json.pro.board.design_settings.rules.min_text_height = pro.board.design_settings.rules.min_text_height;
                }

                {
                    //   https://www.pcbway.com/orderonline.aspx
                    //     Standard PCB > Material
                    //   https://www.pcbway.com/HighQualityOrderOnline.aspx
                    //     Advanced PCB > Material
                    // Output
                    //   json.pro.board.design_settings.rules.min_microvia_diameter
                    //   json.pro.board.design_settings.rules.min_microvia_drill
                    if (pcbway.quoteData.FR4Type[0] == "FR-4") {
                        // mmicrovia not supported
                        json.pro.board.design_settings.rules.min_microvia_diameter = 999;
                        json.pro.board.design_settings.rules.min_microvia_drill = 999;
                    } else if (pcbway.quoteData.FR4Type[0] == "HDI") {
                        json.pro.board.design_settings.rules.min_microvia_diameter = 999; // TBD
                        json.pro.board.design_settings.rules.min_microvia_drill = pcbway.quoteData.radVias[0];
                    } else {
                        json.log.errors.push("Unknown material");
                        resolve(json);
                        return;
                    }
                }

                {
                    // Input
                    //   https://www.pcbway.com/orderonline.aspx
                    //     Standard PCB > Silkscreen
                    //   https://www.pcbway.com/HighQualityOrderOnline.aspx
                    //     Advanced PCB > Silkscreen
                    // Output
                    //    json.pcb.setup.stackup.layer.xxx.color
                    l = json.pcb.setup.stackup.layer.length;
                    json.pcb.setup.stackup.layer[0]["\"F.SilkS\""].color = "\"" + pcbway.quoteData.radFontColor[0] + "\"";
                    json.pcb.setup.stackup.layer[l - 1]["\"B.SilkS\""].color = "\"" + pcbway.quoteData.radFontColor[0] + "\"";
                }

                {
                    // Input
                    //   https://www.pcbway.com/orderonline.aspx
                    //     Standard PCB > Solder mask
                    //   https://www.pcbway.com/HighQualityOrderOnline.aspx
                    //     Advanced PCB > Solder mask
                    // Output
                    //    json.pcb.setup.stackup.layer.xxx.color
                    l = json.pcb.setup.stackup.layer.length;
                    json.pcb.setup.stackup.layer[2]["\"F.Mask\""].color = "\"" + pcbway.quoteData.radSolderColor[0] + "\"";
                    json.pcb.setup.stackup.layer[l - 3]["\"B.Mask\""].color = "\"" + pcbway.quoteData.radSolderColor[0] + "\"";
                }

                // Input
                //   https://www.pcbway.com/orderonline.aspx
                //     Standard PCB > Surface finish
                //   https://www.pcbway.com/HighQualityOrderOnline.aspx
                //     Advanced PCB > Surface finish
                // Output
                //   json.pcb.setup.stackup.copper_finish
                {
                    if (pcbway.quoteData.radPlatingType[0] == "HASL with lead") {
                        json.pcb.setup.stackup.copper_finish = "\"HAL SnPb\"";
                    } else if (pcbway.quoteData.radPlatingType[0] == "HASL lead free") {
                        json.pcb.setup.stackup.copper_finish = "\"HAL lead-free\"";
                    } else if (pcbway.quoteData.radPlatingType[0] == "Immersion gold") {
                        json.pcb.setup.stackup.copper_finish = "\"ENIG\"";
                    } else if (pcbway.quoteData.radPlatingType[0] == "OSP") {
                        json.pcb.setup.stackup.copper_finish = "\"OSP\"";
                    } else if (pcbway.quoteData.radPlatingType[0] == "Hard Gold") {
                        json.pcb.setup.stackup.copper_finish = "\"Hard gold\"";
                    } else if (pcbway.quoteData.radPlatingType[0] == "Immersion Silver") {
                        json.pcb.setup.stackup.copper_finish = "\"Immersion silver\"";
                    } else if (pcbway.quoteData.radPlatingType[0] == "Immersion Tin") {
                        json.pcb.setup.stackup.copper_finish = "\"Immersion tin\"";
                    } else if (pcbway.quoteData.radPlatingType[0] == "HASL lead free+Selective Immersion gold") {
                        json.pcb.setup.stackup.copper_finish = "TBD";
                    } else if (pcbway.quoteData.radPlatingType[0] == "HASL lead free+Selective Hard gold") {
                        json.pcb.setup.stackup.copper_finish = "TBD";
                    } else if (pcbway.quoteData.radPlatingType[0] == "Immersion gold+Selective Hard gold") {
                        json.pcb.setup.stackup.copper_finish = "TBD";
                    } else if (pcbway.quoteData.radPlatingType[0] == "ENEPIG") {
                        json.pcb.setup.stackup.copper_finish = "\"ENEPIG\"";
                    } else if (pcbway.quoteData.radPlatingType[0] == "None") {
                        json.pcb.setup.stackup.copper_finish = "None";
                    } else {
                        json.log.errors.push("Unknown copper finish");
                        resolve(json);
                        return;
                    }
                }

                // Input
                //   https://www.pcbway.com/orderonline.aspx
                //     Standard PCB > Edge connector
                //   https://www.pcbway.com/HighQualityOrderOnline.aspx
                //     Advanced PCB > Edge connector
                // Output
                //   json.pcb.setup.stackup.edge_connector
                {
                    if (pcbway.quoteData.radGoldfingers[0] == "No") {
                        json.pcb.setup.stackup.edge_connector = "no";
                    } else if (pcbway.quoteData.radGoldfingers[0] == "Yes") {
                        if (pcbway.quoteData.hidChamferedborder[1] == "No") {
                            json.pcb.setup.stackup.edge_connector = "yes";
                        } else if (pcbway.quoteData.hidChamferedborder[1] == "Yes (20°)" ||
                            pcbway.quoteData.hidChamferedborder[1] == "Yes (30°)" ||
                            pcbway.quoteData.hidChamferedborder[1] == "Yes (45°)") {
                            json.pcb.setup.stackup.edge_connector = "bevelled";
                        } else {
                            json.log.errors.push("Unknown gold finger bevel");
                            resolve(json);
                            return;
                        }
                    } else {
                        json.log.errors.push("Unknown gold finger");
                        resolve(json);
                        return;
                    }
                }

                // Input
                //   https://www.pcbway.com/orderonline.aspx
                //     Standard PCB > Min track / spacing
                //   https://www.pcbway.com/HighQualityOrderOnline.aspx
                //     Advanced PCB > Min track / spacing
                // Output
                //   json.pro.board.design_settings.rules.min_track_width
                //   json.pro.board.design_settings.rules.min_clearance
                //   json.pro.board.design_settings.rules.min_connection
                //   json.pro.board.design_settings.rules.min_via_annular_width
                {
                    const match = pcbway.quoteData.radLineWeight[0].match(/(\d+)\/(\d+)mil/);
                    if (!match) {
                        json.log.errors.push("Invalid track/spacing format");
                        resolve(json);
                        return;
                    }
                    json.pro.board.design_settings.rules.min_track_width = parseInt(match[1]) * MIL;
                    // unknown so use same as min_track_width
                    json.pro.board.design_settings.rules.min_connection = json.pro.board.design_settings.rules.min_track_width;
                    // unknown so use same as min_track_width
                    json.pro.board.design_settings.rules.min_via_annular_width = json.pro.board.design_settings.rules.min_track_width;
                    json.pro.board.design_settings.rules.min_clearance = parseInt(match[2]) * MIL;
                }

                // Input
                //   https://www.pcbway.com/orderonline.aspx
                //     Standard PCB > Min hole size
                //   https://www.pcbway.com/HighQualityOrderOnline.aspx
                //     Advanced PCB > Min hole size
                // Output
                //   json.pro.board.design_settings.rules.min_via_diameter
                //   json.pro.board.design_settings.rules.min_through_hole_diameter
                {
                    if (pcbway.quoteData.radVias[0] != null) {
                        json.pro.board.design_settings.rules.min_via_diameter = pcbway.quoteData.radVias[0];
                        json.pro.board.design_settings.rules.min_through_hole_diameter = pcbway.quoteData.radVias[0];
                    } else {
                        json.log.errors.push("Min hole size not found");
                        resolve(json);
                        return;
                    }
                }

                { // stackup
                    const copperThickness = pcbway.quoteData.radCopperThickness[0].match(/(\d+) oz Cu/);
                    if (!copperThickness) {
                        json.log.errors.push("Invalid copper thickness format");
                        resolve(json);
                        return;
                    }

                    const layerSplicePosition = -3; // middle of predefined layer array
                    if (pcbway.quoteData.hidLayers[0] == "1" ||
                        pcbway.quoteData.hidLayers[0] == "2") {
                        json.pcb.setup.stackup.layer.splice(layerSplicePosition, 0,
                            {
                                [`"F.Cu"`]: {
                                    "type": "\"copper\"",
                                    "thickness": parseInt(copperThickness) * 0.035
                                }
                            },
                            {
                                [`"dielectric 1"`]: {
                                    "type": "\"core\"",
                                    "thickness": pcbway.quoteData.radBoardThickness[0],
                                    "material": "\"" + pcbway.quoteData.hidFR4TG[0] + "\"",
                                    "epsilon_r": 0, // TBD
                                    "loss_tangent": 0 // TBD
                                }
                            },
                            {
                                [`"B.Cu"`]: {
                                    "type": "\"copper\"",
                                    "thickness": parseInt(copperThickness) * 0.035
                                }
                            });

                        json.pcb.layers[0] = ["\"F.Cu\"", "signal"];
                        json.pcb.layers[31] = ["\"B.Cu\"", "signal"];
                    } else {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(stackup, 'text/html');
                        const boardItems = doc.querySelectorAll(`div.val-board-item.js-val-board-item.js-show` +
                            `[data-Layers='${pcbway.quoteData.hidLayers[0]}']` +
                            `[data-BoardThickness='${pcbway.quoteData.radBoardThickness[0]}']` +
                            `[data-InnerCopperThickness='${parseFloat(pcbway.quoteData.radInsideThickness[0]).toFixed(1)}']` +
                            `[data-CopperThickness='${copperThickness[1]}']`);

                        if (boardItems.length == 0) {
                            json.log.errors.push("No stackup found");
                            resolve(json);
                            return;
                        } else {
                            idxMaxInnerCopperArea = 0;
                            maxInnerCopperArea = 0.0;
                            for (let i = 0; i < boardItems.length; i++) {
                                innerCopperArea = parseFloat(boardItems[i].getAttribute('data-InnerCopperArea'));
                                if (innerCopperArea > maxInnerCopperArea) {
                                    maxInnerCopperArea = innerCopperArea;
                                    idxMaxInnerCopperArea = i;
                                }
                            }

                            if (boardItems.length > 1) {
                                json.log.warnings.push("Multiple stackups found. Using the one with the largest inner layer Residual copper ratio of " + maxInnerCopperArea);
                            }

                            const doc = parser.parseFromString(boardItems[idxMaxInnerCopperArea].innerHTML, 'text/html');
                            const tableVal = doc.querySelector(`div.table-val`);
                            if (tableVal) {
                                const doc = parser.parseFromString(tableVal.innerHTML, 'text/html');
                                const tbody = doc.querySelector('tbody');
                                if (tbody) {
                                    let dielectric = 1;
                                    let innerLayer = 1;
                                    let signalLayer = 0;

                                    const rows = tbody.querySelectorAll('tr');
                                    for (let r = 0; r < rows.length; r++) {
                                        const cells = rows[r].querySelectorAll('td');

                                        if (cells[0].textContent.includes("CU")) {
                                            if (r == 0) {
                                                layerName = "F.Cu";
                                            } else if (r == rows.length - 1) {
                                                layerName = "B.Cu";
                                                signalLayer = 31;
                                            } else {
                                                layerName = "In" + innerLayer + ".Cu";
                                                innerLayer++;
                                            }
                                            json.pcb.setup.stackup.layer.splice(layerSplicePosition, 0,
                                                {
                                                    [layerName]: {
                                                        "type": "\"copper\"",
                                                        "thickness": cells[2].textContent.trim()
                                                    }
                                                });
                                            json.pcb.layers[signalLayer] = ["\"" + layerName + "\"", "signal"];
                                            signalLayer++;
                                        } else if (cells[0].textContent.includes("PP")) {
                                            layerName = "dielectric " + dielectric;
                                            dielectric++;
                                            material = cells[1].textContent.match(/(\d+) RC(\d+)%DK:(\d+\.\d+)/);
                                            if (!material) {
                                                json.log.errors.push("Invalid prepreg material format");
                                                resolve(json);
                                                return;
                                            }
                                            json.pcb.setup.stackup.layer.splice(layerSplicePosition, 0,
                                                {
                                                    [layerName]: {
                                                        "type": "\"prepreg\"",
                                                        "thickness": cells[3].textContent.trim(), // Thickness after lamination (mm)
                                                        "material": "\"" + pcbway.quoteData.hidFR4TG[0] + " " + material[1] + "\"",
                                                        "epsilon_r": parseFloat(material[3]),
                                                        "loss_tangent": 0 // TBD
                                                    }
                                                }
                                            );
                                        } else if (cells[0].textContent.includes("CORE")) {
                                            layerName = "dielectric " + dielectric;
                                            dielectric++;
                                            material = cells[1].textContent.match(/CoreDK:(\d+\.\d+)/);
                                            if (!material) {
                                                json.log.errors.push("Invalid core material format");
                                                resolve(json);
                                                return;
                                            }
                                            json.pcb.setup.stackup.layer.splice(layerSplicePosition, 0,
                                                {
                                                    [layerName]: {
                                                        "type": "\"core\"",
                                                        "thickness": cells[2].textContent.trim(),
                                                        "material": "\"" + pcbway.quoteData.hidFR4TG[0] + "\"",
                                                        "epsilon_r": material[1],
                                                        "loss_tangent": 0 // TBD
                                                    }
                                                }
                                            );
                                        } else {
                                            json.log.errors.push("Unknown stackup layer");
                                            resolve(json);
                                            return;
                                        }
                                    }
                                }
                            } else {
                                console.error("Failed to find table-val");
                            }
                        }
                    }
                }
                console.log(json);
                resolve(json);
            }

            function decodeStep3(pcbway, stackup, rules) {
                console.log("decodeStep3");

                const zip = new JSZip();
                zip.loadAsync(rules).then((data) => {
                    const fileContents = {};
                    const promises = Object.keys(data.files).map(filename => {
                        return data.files[filename].async('text')
                            .then(content => {
                                fileContents[filename] = content;
                            });
                    });

                    Promise.all(promises)
                        .then(() => {
                            //console.log("Extracted files:", fileContents);
                            decodeStep4(pcbway, stackup,
                                fileContents['KiCAD_Custom_DRC_Rules_for_PCBWay/KiCAD_Custom_DRC_Rules_for_PCBWay.kicad_dru'],
                                fileContents['KiCAD_Custom_DRC_Rules_for_PCBWay/KiCAD_Custom_DRC_Rules_for_PCBWay.kicad_pcb'],
                                fileContents['KiCAD_Custom_DRC_Rules_for_PCBWay/KiCAD_Custom_DRC_Rules_for_PCBWay.kicad_prl'],
                                fileContents['KiCAD_Custom_DRC_Rules_for_PCBWay/KiCAD_Custom_DRC_Rules_for_PCBWay.kicad_pro'],
                                fileContents['KiCAD_Custom_DRC_Rules_for_PCBWay/KiCAD_Custom_DRC_Rules_for_PCBWay.kicad_sch']);
                        })
                        .catch(error => {
                            console.error("Failed to extract files:", error);
                            resolve({});
                        });
                });
            };

            // check for kicad rules
            function decodeStep2(pcbway, stackup) {
                console.log("decodeStep2");
                if (pcbway.rulesData == null) {
                    fetch('https://pcbwayfile.s3.us-west-2.amazonaws.com/web/230915/KiCAD_Custom_DRC_Rules_for_PCBWay.zip',
                        {
                            "method": "GET",
                            "headers": {
                                "Content-Type": "application/zip"
                            }
                        }
                    ).then(response => response.blob())
                        .then(data => {
                            pcbway.rulesDate = Date.now();
                            pcbway.rulesData = data;
                            browser.storage.local.set({ pcbway }).then(() => {
                                decodeStep3(pcbway, stackup, data);
                            });
                        }).catch(error => {
                            console.error("Failed to fetch stackup data: " + error);
                            resolve({});
                        });
                } else {
                    decodeStep3(pcbway, stackup, pcbway.rulesData);
                }
            }

            function decodeStep1(pcbway) {
                console.log("decodeStep1");
                if (pcbway.stackupData == null) {
                    fetch('https://www.pcbway.com/multi-layer-laminated-structure.html',
                        {
                            "method": "GET",
                            "headers": {
                                "Content-Type": "application/x-www-form-urlencoded"
                            }
                        }
                    ).then(response => response.text())
                        .then(data => {
                            const zip = new JSZip();
                            zip.file("multi-layer-laminated-structure.html", data);
                            zip.generateAsync({ type: "blob" }).then(function (content) {
                                pcbway.stackupDate = Date.now();
                                pcbway.stackupData = content;
                                browser.storage.local.set({ pcbway }).then(() => {
                                    decodeStep2(pcbway, data);
                                });
                            });
                        }).catch(error => {
                            console.error("Failed to fetch stackup data: " + error);
                            resolve({});
                        });
                } else {
                    const zip = new JSZip();
                    zip.loadAsync(pcbway.stackupData).then((data) => {
                        data.files["multi-layer-laminated-structure.html"].async("text").then(text => {
                            decodeStep2(pcbway, text);
                        });
                    });

                }
            }

            browser.storage.local.get('pcbway').then(result => {
                console.log("PCBWAY decode");
                decodeStep1(result.pcbway);
            });
        });
    }
);
