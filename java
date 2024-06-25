function handleFile() {
    const fileInput = document.getElementById('fileInput').files[0];
    const reader = new FileReader();

    reader.onload = function(event) {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, {header: 1});

        displayData(jsonData);
    };

    if (fileInput) {
        reader.readAsArrayBuffer(fileInput);
    }
}

function displayData(data) {
    const headerRow = document.getElementById('headerRow');
    const dataRows = document.getElementById('dataRows');

    headerRow.innerHTML = '';
    dataRows.innerHTML = '';

    if (data.length > 0) {
        const headers = data[0];
        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            headerRow.appendChild(th);
        });

        data.slice(1).forEach(row => {
            const tr = document.createElement('tr');
            row.forEach(cell => {
                const td = document.createElement('td');
                td.textContent = cell;
                tr.appendChild(td);
            });
            dataRows.appendChild(tr);
        });
    }
}
