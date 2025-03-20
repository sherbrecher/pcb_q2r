statusData = null;

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        window.close();
    }
    if (event.key === 'Enter') {
        document.getElementById('generate').click();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    //browser.storage.local.getBytesInUse().then(bytes => {
    //    const p = document.getElementById('storageSize');
    //    p.textContent = bytes;
    //});

    browser.runtime.sendMessage({ action: 'status' }).then(response => {
        if (response.status === 'success') {
            statusData = response.data;

            const serviceTable = document.getElementById('services');

            // find service with latest updates to set active as default
            let latestService = Object.keys(statusData.services)[0];
            Object.keys(statusData.services).forEach(service => {
                if (statusData.services[service] != null) {
                    if (statusData.services[latestService] == null) {
                        latestService = service;
                    } else {
                        if (statusData.services[service].date > statusData.services[latestService].date) {
                            latestService = service;
                        }
                    }
                }
            });

            Object.keys(statusData.services).forEach(service => {
                const row = document.createElement('tr');
                row.id = "service";

                let cell = document.createElement('td');
                const rdb = document.createElement('input');
                rdb.type = 'radio';
                rdb.name = 'service';
                rdb.value = service;
                if (service === latestService) {
                    rdb.checked = true;
                }
                cell.appendChild(rdb);
                row.appendChild(cell);

                let logoCell = document.createElement('td');
                const img = document.createElement('img');
                img.src = 'services/' + service + '/res/logo.png';
                img.height = 48;
                logoCell.appendChild(img);
                row.appendChild(logoCell);

                let statusCell = document.createElement('td');
                if (statusData.services[service] == null) {
                    statusCell.textContent = 'No data available!';
                } else {
                    statusCell.textContent = statusData.services[service].message;
                }
                row.appendChild(statusCell);

                let deleteCell = document.createElement('td');
                const btn = document.createElement('button');
                btn.textContent = 'Clear Cache';
                btn.addEventListener('click', () => {
                    browser.runtime.sendMessage({
                        action: 'delete',
                        service: service
                    }).then(response => {
                        if (response.status === 'success') {
                            console.log('Cache cleared for', service);
                            statusData.services[service] = null;
                            statusCell.textContent = 'No data available!';
                        } else {
                            console.error('Failed to clear cache for', service);
                        }
                    }).catch(error => {
                        console.error('Error:', error);
                    });
                });
                deleteCell.appendChild(btn);
                row.appendChild(deleteCell);

                row.addEventListener('click', () => {
                    rdb.checked = true;
                });

                serviceTable.appendChild(row);
            });

            const edaTable = document.getElementById('edas');
            firstEda = true;
            Object.keys(statusData.edas).forEach(eda => {
                const row = document.createElement('tr');
                row.id = "eda";

                let cell = document.createElement('td');
                const rdb = document.createElement('input');
                rdb.type = 'radio';
                rdb.name = 'eda';
                rdb.value = eda;
                if (firstEda) {
                    rdb.checked = true;
                    firstEda = false;
                }
                cell.appendChild(rdb);
                row.appendChild(cell);

                cell = document.createElement('td');
                const img = document.createElement('img');
                img.src = 'edas/' + eda + '/res/logo.png';
                img.height = 48;
                cell.appendChild(img);
                row.appendChild(cell);

                edaTable.appendChild(row);
            });

            const generateButton = document.getElementById('generate');
            generateButton.addEventListener('click', () => {
                const selectedServices = Array.from(document.querySelectorAll('input[name="service"]:checked')).map(cb => cb.value);
                const selectedEdas = Array.from(document.querySelectorAll('input[name="eda"]:checked')).map(cb => cb.value);

                let resultText = document.getElementById('result');
                if (!resultText) {
                    const resultDiv = document.createElement('div');
                    resultText = document.createElement('p');
                    resultText.id = 'result';
                    resultDiv.appendChild(resultText);
                    document.body.appendChild(resultDiv);
                }

                if (statusData.services[selectedServices[0]] == null) {
                    resultText.innerHTML = "No data available!";
                } else {
                    browser.runtime.sendMessage({
                        action: 'generate',
                        services: selectedServices,
                        edas: selectedEdas
                    }).then(response => {
                        if (response.status === 'success') {
                            let html = "Generation successful!";

                            if (response.data.service.warnings.length > 0) {
                                html += "\r\n\r\nWarnings:";
                                for (let i = 0; i < response.data.service.warnings.length; i++) {
                                    html += "\r\n" + response.data.service.warnings[i];
                                }
                            }
                            resultText.innerText = html;
                        } else {
                            const resultText = document.getElementById('result');

                            let html = "Generation failed!";

                            if (response.data.service.errors.length > 0) {
                                html += "\r\n\r\nErrors:";
                                for (let error in response.data.service.errors) {
                                    html += "\r\n" + response.data.service.errors[error];
                                }
                            }

                            if (response.data.service.warnings.length > 0) {
                                html += "\r\n\r\nWarnings:";
                                for (let warning in response.data.service.warnings) {
                                    html += "\r\n" + response.data.service.warnings[warning];
                                }
                            }

                            resultText.innerText = html;
                        }
                    }).catch(error => {
                        console.error('Error:', error);
                    });
                }
            });

        } else {
            console.error('Failed to get edas');
        }
    }).catch(error => {
        console.error('Error:', error);
    });
});
