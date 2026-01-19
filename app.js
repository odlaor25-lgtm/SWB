const items = document.getElementById('items');
const totalEl = document.getElementById('total');

function addRow() {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="border w-full"></td>
    <td><input type="number" class="border w-full prev" value="0"></td>
    <td><input type="number" class="border w-full curr" value="0"></td>
    <td class="units text-center">0</td>
    <td><input type="number" class="border w-full price" value="0"></td>
    <td class="sum text-right">0</td>
    <td><button onclick="this.parentElement.parentElement.remove();calc()">❌</button></td>
  `;
  items.appendChild(tr);
  tr.querySelectorAll('input').forEach(i => i.oninput = calc);
}

function calc() {
  let total = 0;
  items.querySelectorAll('tr').forEach(tr => {
    const prev = +tr.querySelector('.prev').value;
    const curr = +tr.querySelector('.curr').value;
    const price = +tr.querySelector('.price').value;
    const unit = curr - prev;
    const sum = unit * price;
    tr.querySelector('.units').innerText = unit > 0 ? unit : 0;
    tr.querySelector('.sum').innerText = sum.toFixed(2);
    total += sum;
  });
  totalEl.innerText = total.toFixed(2);
}

function printBill() {
  window.print();
}

function downloadPDF() {
  html2pdf().from(document.getElementById('bill')).save('swb-rent-bill.pdf');
}

function downloadJPG() {
  htmlToImage.toJpeg(document.getElementById('bill'))
    .then(dataUrl => {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'swb-rent-bill.jpg';
      a.click();
    });
}

addRow();
