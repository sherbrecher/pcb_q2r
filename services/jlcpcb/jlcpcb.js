registerService(
    "jlcpcb", // name
    "https://cart.jlcpcb.com/api/overseas-shop-cart/v1/shoppingCart/calculationGoodsCostsNew", // url
    (details) => { // handler
        if (details.method === "POST" && details.requestBody) {
            function storeQuote(jlcpcb, quote) {
                jlcpcb.quoteDate = Date.now();
                jlcpcb.quoteData = quote;

                browser.storage.local.set({ jlcpcb }).then(() => {
                    console.log("JLCPCB data saved to local storage: " + Date.now());

                    let countdown = 100;
                    const iconInterval = setInterval(() => {
                        if (countdown <= 0) {
                            clearInterval(iconInterval);
                            browser.action.setIcon({ path: "res/icons/icon.png" });
                        } else {
                            browser.action.setIcon({ path: `services/jlcpcb/res/favicon/favicon_${countdown}.png` });
                            countdown -= 10;
                        }
                    }, 50);
                }), (error => {
                    console.error("Failed to save JLCPCB data to local storage: " + error);
                });
            }

            const rawData = details.requestBody.raw[0].bytes;
            const decoder = new TextDecoder("utf-8");
            const jsonString = decoder.decode(rawData);

            jsonData = {};
            try {
                jsonData = JSON.parse(jsonString);
            } catch (error) {
                console.error("Error parsing JSON:", error);
                return;
            }

            browser.storage.local.get('jlcpcb').then(result => {
                if (SHOW_QUOTE_CHANGES) {
                    console.log("JLCPCB data changes:");
                    compareObjects(result.jlcpcb.data, jsonData);
                }
                storeQuote(result.jlcpcb, jsonData);
            }).catch(error => {
                storeQuote({}, jsonData);
            });
        }
    },
    () => { // handler_status
        return new Promise((resolve, reject) => {
            browser.storage.local.get(['jlcpcb']).then(result => {
                let lastQuote = "N/A";
                if (result.jlcpcb.quoteDate != null) {
                    lastQuote = (new Date(result.jlcpcb.quoteDate)).toLocaleString();
                }
                let lastStackup = "N/A";
                if (result.jlcpcb.stackupDate != null) {
                    lastStackup = (new Date(result.jlcpcb.stackupDate)).toLocaleString();
                }
                let status = `Quote: ${lastQuote}\r\nStackup: ${lastStackup}`;
                resolve({ date: result.jlcpcb.quoteDate, message: status });
            }).catch(error => {
                resolve(null);
            });
        });
    },
    () => { // delete_cache
        return new Promise((resolve, reject) => {
            browser.storage.local.remove('jlcpcb').then(result => {
                console.log("JLCPCB data deleted from local storage");
                resolve(result);
            }).catch(error => {
                console.log("JLCPCB delete error: " + error);
                reject(error);
            });
        });
    },
    (json) => { // decoder
        return new Promise((resolve, reject) => {
            function decodeStep2(jlcpcb, stackup) {
                function searchRecursive(obj, key, value) {
                    if (typeof obj !== 'object' || obj === null) {
                        return false;
                    }
                    if (obj.hasOwnProperty(key) && obj[key] === value) {
                        return true;
                    }
                    for (let k in obj) {
                        if (obj.hasOwnProperty(k)) {
                            if (searchRecursive(obj[k], key, value)) {
                                return true;
                            }
                        }
                    }
                    return false;
                }

                function searchForKey(obj, key) {
                    if (typeof obj !== 'object' || obj === null) {
                        return null;
                    }
                    if (obj.hasOwnProperty(key)) {
                        return obj[key];
                    }
                    for (let k in obj) {
                        if (obj.hasOwnProperty(k)) {
                            const result = searchForKey(obj[k], key);
                            if (result !== null) {
                                return result;
                            }
                        }
                    }
                    return null;
                }

                plateType = searchForKey(jlcpcb.quoteData, "plateType");
                stencilLayer = searchForKey(jlcpcb.quoteData, "stencilLayer");
                stencilPly = searchForKey(jlcpcb.quoteData, "stencilPly");
                cuprumThickness = searchForKey(jlcpcb.quoteData, "cuprumThickness");
                adornPut = searchForKey(jlcpcb.quoteData, "adornPut");
                adornColor = searchForKey(jlcpcb.quoteData, "adornColor");
                insideCuprumThickness = searchForKey(jlcpcb.quoteData, "insideCuprumThickness");
                cuprumThickness = searchForKey(jlcpcb.quoteData, "cuprumThickness");
                goldFingerBevel = searchForKey(jlcpcb.quoteData, "goldFingerBevel");

                json.log.raw = { "calculationGoodsCostsNew": JSON.stringify(jlcpcb.quoteData) };

                // default settings
                {
                    // Input
                    //   https://jlcpcb.com/capabilities/pcb-capabilities
                    //     Rigid PCB > Traces > NPTH to Track
                    // Output
                    //  json.pro.board.design_settings.rules.min_hole_clearance
                    json.pro.board.design_settings.rules.min_hole_clearance = 0.2;

                    // Input
                    //   https://jlcpcb.com/capabilities/pcb-capabilities
                    //     Rigid PCB > Outline > Routed
                    // Output
                    //   json.pro.board.design_settings.rules.min_copper_edge_clearance
                    json.pro.board.design_settings.rules.min_copper_edge_clearance = 0.2;

                    // Input
                    //   https://jlcpcb.com/capabilities/pcb-capabilities
                    //     Rigid PCB > Drilling > Via Hole-to-Hole Spacing
                    // Output
                    //   json.pro.board.design_settings.rules.min_hole_to_hole
                    json.pro.board.design_settings.rules.min_hole_to_hole = 0.2;

                    // Input
                    //   https://jlcpcb.com/capabilities/pcb-capabilities
                    //     Rigid PCB > Drilling > Blind/Buried Vias
                    // Output
                    //   json.pro.board.design_settings.rules.min_microvia_diameter
                    //   json.pro.board.design_settings.rules.min_microvia_drill
                    // Not supported by JLCPCB so set high value
                    json.pro.board.design_settings.rules.min_microvia_diameter = 999;
                    json.pro.board.design_settings.rules.min_microvia_drill = 999;

                    //json.pro.board.design_settings.rules.min_text_height = 1.0; // 1mm = 40mil
                    //json.pro.board.design_settings.rules.min_text_height = 0.153; // 0.153mm = 6mil
                    //json.pro.board.design_settings.rules.min_text_height = 0.3;
                    //json.pro.board.design_settings.rules.min_text_height = 0.1;
                    //json.pro.board.design_settings.rules.min_text_height = 0.1;

                    json.pcb.setup.stackup.layer = [
                        { "\"F.SilkS\"": { "type": "\"silk screen\"" } },
                        { "\"F.Paste\"": { "type": "\"solder paste\"" } },
                        { "\"F.Mask\"": { "type": "\"solder mask\"", "thickness": 0.03048, "color": "\"green\"" } },
                        { "\"B.Mask\"": { "type": "\"solder mask\"", "thickness": 0.03048, "color": "\"green\"" } },
                        { "\"B.Paste\"": { "type": "\"solder paste\"" } },
                        { "\"B.SilkS\"": { "type": "\"silk screen\"" } }
                    ];
                }

                {
                    if (adornColor != null) {
                        // https://jlcpcb.com/capabilities/pcb-capabilities
                        // Soldermask
                        l = json.pcb.setup.stackup.layer.length;
                        json.pcb.setup.stackup.layer[2]["\"F.Mask\""].color = "\"" + adornColor + "\"";
                        json.pcb.setup.stackup.layer[l - 3]["\"B.Mask\""].color = "\"" + adornColor + "\"";
                    }
                }

                // Input
                //   https://jlcpcb.com/capabilities/pcb-capabilities
                //     Rigid PCB > Traces > Min. track width and spacing (1 oz)
                //     Rigid PCB > Traces > Min. track width and spacing (2 oz)
                //   https://cart.jlcpcb.com/quote
                //     Standard PCB/PCBA > High-spec Options >  Outer Copper Weight
                //     Standard PCB/PCBA > Layers
                // Output
                //   json.pro.board.design_settings.rules.min_track_width
                //   json.pro.board.design_settings.rules.min_clearance
                //   json.pro.board.design_settings.rules.min_connection
                //   json.dru
                {
                    // https://jlcpcb.com/capabilities/pcb-capabilities
                    // Rigid PCB > Traces > Min. track width and spacing (1 oz)
                    if (cuprumThickness == 1) {
                        if (stencilLayer <= 2) {
                            // https://jlcpcb.com/capabilities/pcb-capabilities
                            // 1- and 2-layer: 0.10 / 0.10 mm (4 / 4 mil)
                            json.pro.board.design_settings.rules.min_track_width = 0.10;
                            // unknown so use same as min_track_width
                            json.pro.board.design_settings.rules.min_connection = json.pro.board.design_settings.rules.min_track_width;
                            json.pro.board.design_settings.rules.min_clearance = 0.10;
                        } else {
                            // https://jlcpcb.com/capabilities/pcb-capabilities
                            // // Multilayer: 0.09 / 0.09 mm (3.5 / 3.5 mil)
                            json.pro.board.design_settings.rules.min_track_width = 0.09;
                            // unknown so use same as min_track_width
                            json.pro.board.design_settings.rules.min_connection = json.pro.board.design_settings.rules.min_track_width;
                            json.pro.board.design_settings.rules.min_clearance = 0.09;
                        }

                        // https://jlcpcb.com/capabilities/pcb-capabilities
                        // 3 mil is acceptable in BGA fan-outs
                        json.dru +=
                            '(rule clearance_BGA_fan_out\n' + '\n' +
                            '	( constraint clearance (min 3mil))\n' +
                            '	( constraint track_width (min 3mil))\n' +
                            '	( condition "A.insideCourtyard( \'BGA\')")\n' +
                            ')\n';
                    }
                    // https://jlcpcb.com/capabilities/pcb-capabilities
                    // Rigid PCB > Traces > Min. track width and spacing (2 oz)
                    else if (cuprumThickness == 2) {
                        if (stencilLayer == 1) {
                            json.log.errors.push("2 oz is not available for 1-layer boards");
                            resolve(json);
                            return;
                        } else if (stencilLayer == 2) {
                            // https://jlcpcb.com/capabilities/pcb-capabilities
                            // 2-layer: 0.16 / 0.16 mm (6.5 / 6.5 mil)
                            json.pro.board.design_settings.rules.min_track_width = 0.16;
                            // unknown so use same as min_track_width
                            json.pro.board.design_settings.rules.min_connection = json.pro.board.design_settings.rules.min_track_width;
                            json.pro.board.design_settings.rules.min_clearance = 0.16;
                        } else {
                            // https://jlcpcb.com/capabilities/pcb-capabilities
                            // Multilayer: 0.16 / 0.20 mm (6.5 / 8 mil)
                            json.pro.board.design_settings.rules.min_track_width = 0.16;
                            // unknown so use same as min_track_width
                            json.pro.board.design_settings.rules.min_connection = json.pro.board.design_settings.rules.min_track_width;
                            json.pro.board.design_settings.rules.min_clearance = 0.20;
                        }
                    } else {
                        json.log.errors.push("Unknown cuprum thickness");
                        resolve(json);
                        return;
                    }
                }

                // Input
                //   https://jlcpcb.com/capabilities/pcb-capabilities
                //     Rigid PCB > Drilling > Min. Via hole size/diameter
                //   https://cart.jlcpcb.com/quote
                //     Standard PCB/PCBA > Layers
                // Output
                //   json.pro.board.design_settings.rules.min_via_annular_width
                //   json.pro.board.design_settings.rules.min_via_diameter
                {
                    if (stencilLayer == 1) {
                        // https://jlcpcb.com/capabilities/pcb-capabilities
                        // 1-layer (NPTH only): 0.3 mm hole size / 0.5 mm via diameter
                        json.pro.board.design_settings.rules.min_via_annular_width = 0.1;
                        json.pro.board.design_settings.rules.min_via_diameter = 0.5;
                    } else if (stencilLayer == 2) {
                        // https://jlcpcb.com/capabilities/pcb-capabilities
                        // 2-layer: 0.15mm hole size / 0.25mm via diameter
                        json.pro.board.design_settings.rules.min_via_annular_width = 0.05;
                        json.pro.board.design_settings.rules.min_via_diameter = 0.25;
                    } else {
                        // https://jlcpcb.com/capabilities/pcb-capabilities
                        // Multilayer: 0.15 mm hole size / 0.25 mm via diameter
                        json.pro.board.design_settings.rules.min_via_annular_width = 0.05;
                        json.pro.board.design_settings.rules.min_via_diameter = 0.25;
                    }
                }

                // Input
                //   https://jlcpcb.com/capabilities/pcb-capabilities
                //     Rigid PCB > Drilling > Drill Diameter
                //   https://cart.jlcpcb.com/quote
                //     Standard PCB/PCBA > Base Material
                //     Standard PCB/PCBA > Layers
                //     Standard PCB/PCBA > High-spec Options > Min via hole size/diameter
                // Output
                //   json.pro.board.design_settings.rules.min_through_hole_diameter
                {
                    if (plateType == 1 || // FR4
                        plateType == 7 || // Flex
                        plateType == 5 || // Rogers
                        plateType == 6) { // PFTE Teflon
                        if (stencilLayer == 1) {
                            json.pro.board.design_settings.rules.min_through_hole_diameter = 0.3;
                        } else {
                            if (searchRecursive(jlcpcb.quoteData, "configOptionAccessId", "4b54c699cb784c3f85b0fd95c66a3a2b")) {
                                json.pro.board.design_settings.rules.min_through_hole_diameter = 0.3;
                            } else if (searchRecursive(jlcpcb.quoteData, "configOptionAccessId", "1ff895a30dcf4e808222e766404a2529")) {
                                json.pro.board.design_settings.rules.min_through_hole_diameter = 0.25;
                            } else if (searchRecursive(jlcpcb.quoteData, "configOptionAccessId", "b37be282ca0e4b90ac1bf17b6c81810f")) {
                                json.pro.board.design_settings.rules.min_through_hole_diameter = 0.2;
                            } else if (searchRecursive(jlcpcb.quoteData, "configOptionAccessId", "07053cdb36784132b3bbac65b77bb81e")) {
                                json.pro.board.design_settings.rules.min_through_hole_diameter = 0.15;
                            } else {
                                json.log.errors.push("Unknown diameter setting");
                                resolve(json);
                                return;
                            }
                        }
                    } else if (plateType == 2) { // Aluminium
                        json.pro.board.design_settings.rules.min_through_hole_diameter = 0.65;
                    } else if (plateType == 4) { // Copper Core
                        json.pro.board.design_settings.rules.min_through_hole_diameter = 1.0;
                    } else {
                        json.log.errors.push("Unknown plate type");
                        resolve(json);
                        return;
                    }
                }

                // Input
                //   https://cart.jlcpcb.com/quote
                //     Standard PCB/PCBA > High-spec Options > Edge Plating
                // Output
                //   json.pcb.setup.stackup.edge_plating
                {
                    if (searchRecursive(jlcpcb.quoteData, "configOptionAccessId", "107743b376514db58f49b672f2fad07f")) {
                        console.log("Edge plating: no");
                        json.pcb.setup.stackup.edge_plating = "no";
                    } else if (searchRecursive(jlcpcb.quoteData, "configOptionAccessId", "f3b9cdbaa8504abd84f25be24691376f")) {
                        console.log("Edge plating: yes");
                        json.pcb.setup.stackup.edge_plating = "yes";
                    }
                }

                // Input
                //   https://cart.jlcpcb.com/quote
                //     Standard PCB/PCBA > PCB Specifications > Surface Finish
                // Output
                //   json.pcb.setup.stackup.copper_finish
                {
                    if (adornPut == "ENIG-RoHS") {
                        json.pcb.setup.stackup.copper_finish = "\"ENIG\"";
                    } else if (adornPut == "HASL(with lead)") {
                        json.pcb.setup.stackup.copper_finish = "\"HAL SnPb\"";
                    } else if (adornPut == "LeadFree HASL-RoHS") {
                        json.pcb.setup.stackup.copper_finish = "\"HAL lead-free\"";
                    } else if (adornPut == "OSP") {
                        json.pcb.setup.stackup.copper_finish = "\"OSP\"";
                    } else {
                        json.log.errors.push("Unknown copper finish");
                        resolve(json);
                        return;
                    }
                }

                // Input
                //   https://cart.jlcpcb.com/quote
                //     Standard PCB/PCBA > High-spec Options > Gold Fingers
                //     Standard PCB/PCBA > High-spec Options > 30°finger chamfered
                // Output
                //   json.pcb.setup.stackup.edge_connector
                {
                    if (goldFingerBevel == 0) {
                        json.pcb.setup.stackup.edge_connector = "no";
                    } else if (goldFingerBevel == 1) {
                        json.pcb.setup.stackup.edge_connector = "yes";
                    } else if (goldFingerBevel == 2) {
                        // https://cart.jlcpcb.com/quote
                        //  30°finger chamfered
                        json.pcb.setup.stackup.edge_connector = "bevelled";
                    } else {
                        json.log.errors.push("Unknown gold finger bevel");
                        resolve(json);
                        return;
                    }
                }

                { // stackup
                    // https://jlcpcb.com/impedance
                    // https://jlcpcb.com/help/article/User-Guide-to-the-JLCPCB-Impedance-Calculator

                    material1to8layers = {
                        "FR4-Standard TG 135-140": {
                            "core": {
                                "name": "Undefined (FR4-Standard TG 135-140)",
                                "thickness": {
                                    "1.6": { "epsilon_r": 0, "loss_tangent": 0 } // no values defined from JLCPCB
                                }
                            },
                            "prepreg": {
                                "1080*1": {
                                    "name": "Undefined 1080*1", "thickness": {
                                        [3.3 * MIL]: { "epsilon_r": 0, "loss_tangent": 0 }
                                    }
                                },
                                "2116*1": {
                                    "name": "Undefined 2116*1", "thickness": {
                                        [4.9 * MIL]: { "epsilon_r": 0, "loss_tangent": 0 }
                                    }
                                },
                                "3313*1": {
                                    "name": "Undefined 3313*1", "thickness": {
                                        [4.2 * MIL]: { "epsilon_r": 0, "loss_tangent": 0 }
                                    }
                                },
                                "7628*1": {
                                    "name": "Undefined 7628*1", "thickness": {
                                        [8.6 * MIL]: { "epsilon_r": 0, "loss_tangent": 0 },
                                    }
                                }
                            }
                        },
                        "FR-4 TG155": {
                            "core": {
                                "name": "Nan Ya Plastics NP-155F (FR-4 TG155)",
                                "thickness": {
                                    "0.08": { "epsilon_r": 3.99, "loss_tangent": 0.02 },
                                    "0.1": { "epsilon_r": 4.36, "loss_tangent": 0.02 },
                                    "0.13": { "epsilon_r": 4.17, "loss_tangent": 0.02 },
                                    "0.15": { "epsilon_r": 4.36, "loss_tangent": 0.02 },
                                    "0.2": { "epsilon_r": 4.36, "loss_tangent": 0.02 },
                                    "0.25": { "epsilon_r": 4.23, "loss_tangent": 0.02 },
                                    "0.3": { "epsilon_r": 4.41, "loss_tangent": 0.02 },
                                    "0.35": { "epsilon_r": 4.36, "loss_tangent": 0.02 },
                                    "0.4": { "epsilon_r": 4.36, "loss_tangent": 0.02 },
                                    "0.45": { "epsilon_r": 4.36, "loss_tangent": 0.02 },
                                    "0.5": { "epsilon_r": 4.48, "loss_tangent": 0.02 },
                                    "0.55": { "epsilon_r": 4.41, "loss_tangent": 0.02 },
                                    "0.6": { "epsilon_r": 4.36, "loss_tangent": 0.02 },
                                    "0.65": { "epsilon_r": 4.36, "loss_tangent": 0.02 },
                                    "0.7": { "epsilon_r": 4.53, "loss_tangent": 0.02 },
                                    "0.71": { "epsilon_r": 4.43, "loss_tangent": 0.02 } // >0.7
                                }
                            },
                            "prepreg": {
                                "1080*1": {
                                    "name": "Nan Ya Plastics NP-155F 1080", "thickness": {
                                        [3.3 * MIL]: { "epsilon_r": 3.91, "loss_tangent": 0.02 }
                                    }
                                },
                                "2116*1": {
                                    "name": "Nan Ya Plastics NP-155F 2116", "thickness": {
                                        [4.9 * MIL]: { "epsilon_r": 4.16, "loss_tangent": 0.02 }
                                    }
                                },
                                "3313*1": {
                                    "name": "Nan Ya Plastics NP-155F 3313", "thickness": {
                                        [4.2 * MIL]: { "epsilon_r": 4.1, "loss_tangent": 0.02 }
                                    }
                                },
                                "7628*1": {
                                    "name": "Nan Ya Plastics NP-155F 7628", "thickness": {
                                        [8.6 * MIL]: { "epsilon_r": 4.4, "loss_tangent": 0.02 },
                                    }
                                }
                            }
                        }
                    };

                    material10pluslayers = {
                        "core": {
                            "FR-4 TG170": {
                                "name": "SYTECH (Shengyi) S1000-2M (FR-4 TG170)",
                                "thickness": {
                                    "0.075": { "epsilon_r": 4.14, "loss_tangent": 0.018 },
                                    "0.1": { "epsilon_r": 4.11, "loss_tangent": 0.018 },
                                    "0.13": { "epsilon_r": 4.03, "loss_tangent": 0.018 },
                                    "0.15": { "epsilon_r": 4.35, "loss_tangent": 0.018 },
                                    "0.2": { "epsilon_r": 4.42, "loss_tangent": 0.018 },
                                    "0.25": { "epsilon_r": 4.29, "loss_tangent": 0.018 },
                                    "0.3": { "epsilon_r": 4.56, "loss_tangent": 0.018 }
                                }
                            }
                        },
                        "prepreg": {
                            "106*1": {
                                "name": "SYTECH (Shengyi) S1000-2M 106", "thickness": {
                                    [1.97 * MIL]: { "epsilon_r": 3.92, "loss_tangent": 0.018 }
                                }
                            },
                            "1080*1": {
                                "name": "SYTECH (Shengyi) S1000-2M 1080", "thickness": {
                                    [3.31 * MIL]: { "epsilon_r": 3.99, "loss_tangent": 0.018 }
                                }
                            },
                            "2313*1": {
                                "name": "SYTECH (Shengyi) S1000-2M 2313", "thickness": {
                                    [4.09 * MIL]: { "epsilon_r": 4.31, "loss_tangent": 0.018 }
                                }
                            },
                            "2116*1": {
                                "name": "SYTECH (Shengyi) S1000-2M 2116", "thickness": {
                                    [5.00 * MIL]: { "epsilon_r": 4.29, "loss_tangent": 0.018 }
                                }
                            }
                        }
                    };

                    if (stencilLayer < 10) {
                        material = material1to8layers;
                    } else {
                        material = material10pluslayers;
                    }

                    // find core material
                    coreMaterial = null;
                    //if (searchRecursive(jlcpcb.quoteData, "configOptionShow", "FR4-Standard TG 135-140")) {
                    if (searchRecursive(jlcpcb.quoteData, "configOptionAccessId", "8b0ffaca40684210985ec62922ea2bf0")) {
                        coreMaterial = "FR4-Standard TG 135-140";
                        json.log.warnings.push("JLC does not specify Epsilon R and Loss Tan for FR4-Standard TG 135-140");
                        //} else if (searchRecursive(jlcpcb.quoteData, "configOptionShow", "FR-4 TG155")) {
                    } else if (searchRecursive(jlcpcb.quoteData, "configOptionAccessId", "78e09a3a83fb420191b3ee4ba4b825e9")) {
                        coreMaterial = "FR-4 TG155";
                        //} else if (searchRecursive(jlcpcb.quoteData, "configOptionShow", "FR-4 TG170")) {
                    } else if (searchRecursive(jlcpcb.quoteData, "configOptionAccessId", "e61a5e93ee6f4b17ba6099e38992241d")) {
                        coreMaterial = "FR-4 TG170";
                    } else {
                        json.log.errors.push("Unknown core material");
                        resolve(json);
                        return;
                    }

                    function getEpsilonR(material, thickness) {
                        let epsilon_r = -1;
                        const thicknessNum = parseFloat(thickness);
                        let minDiff = Number.MAX_VALUE;
                        let closestThickness = null;

                        // Search through all thickness keys
                        for (let key in material.thickness) {
                            const keyNum = parseFloat(key);
                            if (!isNaN(keyNum)) {
                                const diff = Math.abs(keyNum - thicknessNum);
                                if (diff < minDiff) {
                                    minDiff = diff;
                                    closestThickness = key;
                                    epsilon_r = material.thickness[key].epsilon_r;
                                }
                            }
                        }

                        // Add warning about thickness difference if needed
                        if (minDiff > 0.001) { // More than 1um difference
                            if (!json.log.warnings) {
                                json.log.warnings = [];
                            }
                            json.log.warnings.push(`Using Epsilon R=${epsilon_r} from thickness=${closestThickness}mm for requested thickness=${thickness}mm (diff=${minDiff.toFixed(3)}mm)`);
                        }

                        return epsilon_r;

                        //try {
                        //    return material.thickness[thickness].epsilon_r;
                        //} catch (error) {
                        //    console.log('Epsilon R is undefined for ' + material.name + ' with thickness ' + thickness);
                        //    json.log.errors.push('Epsilon R is undefined for ' + material.name + ' with thickness ' + thickness);
                        //    //return material.thickness.default.epsilon_r;
                        //    return -1;
                        //}
                    }

                    function getLossTangent(material, thickness) {
                        let loss_tangent = -1;
                        const thicknessNum = parseFloat(thickness);
                        let minDiff = Number.MAX_VALUE;
                        let closestThickness = null;

                        // Search through all thickness keys
                        for (let key in material.thickness) {
                            const keyNum = parseFloat(key);
                            if (!isNaN(keyNum)) {
                                const diff = Math.abs(keyNum - thicknessNum);
                                if (diff < minDiff) {
                                    minDiff = diff;
                                    closestThickness = key;
                                    loss_tangent = material.thickness[key].loss_tangent;
                                }
                            }
                        }

                        // Add warning about thickness difference if needed
                        if (minDiff > 0.001) { // More than 1um difference
                            if (!json.log.warnings) {
                                json.log.warnings = [];
                            }
                            json.log.warnings.push(`Using Loss Tan=${loss_tangent} from thickness=${closestThickness}mm for requested thickness=${thickness}mm (diff=${minDiff.toFixed(3)}mm)`);
                        }

                        return loss_tangent;

                        //try {
                        //    return material.thickness[thickness].loss_tangent;
                        //} catch (error) {
                        //    console.log('Loss Tangent is undefined for ' + material.name + ' with thickness ' + thickness);
                        //    json.log.errors.push('Loss Tangent is undefined for ' + material.name + ' with thickness ' + thickness);
                        //    //return material.thickness.default.loss_tangent;
                        //    return -1;
                        //}
                    }

                    const layerSplicePosition = -3; // middle of predefined layer array
                    if (stencilLayer == 1 || stencilLayer == 2) {
                        json.pcb.setup.stackup.layer.splice(layerSplicePosition, 0,
                            {
                                [`"F.Cu"`]: {
                                    "type": "\"copper\"",
                                    "thickness": cuprumThickness == 1 ? "0.035" : "0.070"
                                }
                            },
                            {
                                [`"dielectric 1"`]: {
                                    "type": "\"core\"",
                                    "thickness": stencilPly,
                                    "material": "\"" + material[coreMaterial].core.name + "\"",
                                    "epsilon_r": getEpsilonR(material[coreMaterial].core, stencilPly),
                                    "loss_tangent": getLossTangent(material[coreMaterial].core, stencilPly)
                                }
                            },
                            {
                                [`"B.Cu"`]: {
                                    "type": "\"copper\"",
                                    "thickness": cuprumThickness == 1 ? "0.035" : "0.070"
                                }
                            });
                        json.pcb.layers[0] = ["\"F.Cu\"", "signal"];
                        json.pcb.layers[31] = ["\"B.Cu\"", "signal"];
                    } else {
                        defaultImpedanceTemplateCode = {
                            4: {
                                1: { 0.5: "20220913081702565", 1: "20220913081702563", 2: "20220913081704629" },
                                2: { 0.5: "20220913081704643", 1: "20220913081704647", 2: "20220913081703622" }
                            }
                        };

                        if (jlcpcb.quoteData.pcbGoodsRequest.impedanceTemplateCode == null) {
                            jlcpcb.quoteData.pcbGoodsRequest.impedanceTemplateCode =
                                defaultImpedanceTemplateCode[stencilLayer][cuprumThickness][insideCuprumThickness];
                        }
                        for (let i = 0; i < stackup.data.length; i++) {
                            if (stackup.data[i].impedanceTemplateCode == jlcpcb.quoteData.pcbGoodsRequest.impedanceTemplateCode) {
                                let prefix = "F";
                                let dielectric = 1;
                                let innerLayer = 1;
                                let signalLayer = 0;
                                let coreCount = stackup.data[i].iaminationList.reduce((count, item) => {
                                    const laminat = JSON.parse(item.content);
                                    return count + ("coreBoardLayer1" in laminat ? 1 : 0);
                                }, 0);
                                //console.log(coreCount);

                                for (let k = 0; k < stackup.data[i].iaminationList.length; k++) {
                                    const laminat = JSON.parse(stackup.data[i].iaminationList[k].content);
                                    //console.log(laminat);
                                    if ("LineLayer" in laminat) {
                                        json.pcb.setup.stackup.layer.splice(layerSplicePosition, 0,
                                            {
                                                [`"${prefix}.Cu"`]: {
                                                    "type": "\"copper\"",
                                                    "thickness": laminat.LineThickness.replace("mm", "")
                                                }
                                            });
                                        json.pcb.layers[signalLayer] = ["\"" + prefix + ".Cu\"", "signal"];
                                        signalLayer = signalLayer + 1;
                                    } else if ("preLayer" in laminat) {
                                        if (prefix == "In" && coreCount == 0) {
                                            prefix = "B";
                                        }
                                        //console.log(laminat.preMaterialType);
                                        if (laminat.preLayer == "Prepreg") {
                                            preMaterialType = laminat.preMaterialType.trim();
                                            preMaterial = material[coreMaterial].prepreg[preMaterialType];
                                            preLayerType = "prepreg";
                                        } else if (laminat.preLayer == "Core") {
                                            preMaterialType = coreMaterial;
                                            preMaterial = material[coreMaterial].core;
                                            preLayerType = "core";
                                        } else {
                                            json.log.errors.push("Unknown layer type");
                                            resolve(json);
                                            return;
                                        }
                                        let lastLayerKey = Object.keys(json.pcb.setup.stackup.layer[
                                            json.pcb.setup.stackup.layer.length + layerSplicePosition - 1])[0];
                                        let lastLayer = json.pcb.setup.stackup.layer[
                                            json.pcb.setup.stackup.layer.length + layerSplicePosition - 1][lastLayerKey];
                                        thickness = laminat.preThickness.replace("mm", "");
                                        if (lastLayer.type == "\"prepreg\"" || lastLayer.type == "\"core\"") {
                                            if (!("sublayer" in lastLayer)) {
                                                lastLayer["sublayer"] = [];
                                            }
                                            lastLayer["sublayer"].push({
                                                "thickness": thickness,
                                                "material": "\"" + preMaterial.name + "\"",
                                                "epsilon_r": getEpsilonR(preMaterial, thickness),
                                                "loss_tangent": getLossTangent(preMaterial, thickness)
                                            });
                                            if (preLayerType == "core") {
                                                lastLayer["type"] = '"core"';
                                            }
                                        } else {
                                            json.pcb.setup.stackup.layer.splice(layerSplicePosition, 0,
                                                {
                                                    [`"dielectric ${dielectric}"`]: {
                                                        "type": "\"" + preLayerType + "\"",
                                                        "thickness": thickness,
                                                        "material": "\"" + preMaterial.name + "\"",
                                                        "epsilon_r": getEpsilonR(preMaterial, thickness),
                                                        "loss_tangent": getLossTangent(preMaterial, thickness)
                                                    }
                                                });
                                            dielectric = dielectric + 1;
                                        }
                                    } else if ("coreBoardLayer1" in laminat) {
                                        if (prefix == "F") {
                                            prefix = "In";
                                        }
                                        coreCount = coreCount - 1;

                                        let n = 1;
                                        while ("coreBoardLayer" + n in laminat) {
                                            //console.log("coreBoardLayer" + n);

                                            if (laminat["coreBoardLayer" + n] == "inner Layer") {
                                                json.pcb.setup.stackup.layer.splice(layerSplicePosition, 0,
                                                    {
                                                        [`"${prefix}${innerLayer}.Cu"`]: {
                                                            "type": "\"copper\"",
                                                            "thickness": laminat["coreBoardThickness" + n].replace("mm", "")
                                                        }
                                                    });
                                                json.pcb.layers[signalLayer] = ["\"" + prefix + innerLayer + ".Cu\"", "signal"];
                                                signalLayer = signalLayer + 1;
                                                innerLayer = innerLayer + 1;
                                            } else if (laminat["coreBoardLayer" + n] == "Core") {
                                                thickness = laminat["coreBoardThickness" + n].replace("mm", "");
                                                json.pcb.setup.stackup.layer.splice(layerSplicePosition, 0,
                                                    {
                                                        [`"dielectric ${dielectric}"`]: {
                                                            "type": "\"core\"",
                                                            "thickness": thickness,
                                                            "material": "\"" + material[coreMaterial].core.name + "\"",
                                                            "epsilon_r": getEpsilonR(material[coreMaterial].core, thickness),
                                                            "loss_tangent": getLossTangent(material[coreMaterial].core, thickness)
                                                        }
                                                    });
                                                dielectric = dielectric + 1;
                                            } else {
                                                json.log.errors.push("Unknown layer type");
                                                resolve(json);
                                                return;
                                            }
                                            n = n + 1;
                                        }
                                    } else {
                                        json.log.errors.push("Unknown layer type");
                                        resolve(json);
                                        return;
                                    }
                                }
                                //console.log(json.pcb.setup.stackup.layer);
                                break;
                            }
                        }
                    }
                }

                console.log(json);
                resolve(json);
            }

            function decodeStep1(jlcpcb) {
                console.log("JLCPCB decode step 1");
                if (jlcpcb.stackupData == null) {
                    fetch("https://jlcpcb.com/api/overseas-shop-cart/v1/shoppingCart/getImpedanceTemplateSettings",
                        {
                            "method": "POST",
                            "headers": {
                                "Content-Type": "application/json"
                            },
                            "body": JSON.stringify({
                                "stencilLayer": null,
                                "stencilPly": null,
                                "cuprumThickness": null,
                                "insideCuprumThickness": null
                            })
                        })
                        .then(response => response.json())
                        .then(data => {
                            //downloadFile(data, "getImpedanceTemplateSettings.json");
                            const zip = new JSZip();
                            zip.file("getImpedanceTemplateSettings", JSON.stringify(data));
                            zip.generateAsync({ type: "blob" }).then(function (content) {
                                jlcpcb.stackupDate = Date.now();
                                jlcpcb.stackupData = content;
                                browser.storage.local.set({ jlcpcb }).then(() => {
                                    decodeStep2(jlcpcb, data);
                                });
                            });
                        }).catch(error => {
                            console.error("Failed to fetch JLCPCB stackup data: " + error);
                            resolve({});
                        });
                } else {
                    const zip = new JSZip();
                    zip.loadAsync(jlcpcb.stackupData).then((data) => {
                        data.files["getImpedanceTemplateSettings"].async("text").then(text => {
                            decodeStep2(jlcpcb, JSON.parse(text));
                        });
                    });
                }
            }

            browser.storage.local.get('jlcpcb').then(result => {
                console.log("JLCPCB decode");
                decodeStep1(result.jlcpcb);
            });
        });
    }
);