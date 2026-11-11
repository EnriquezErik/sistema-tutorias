const assert=require('assert');
const fs=require('fs');
const vm=require('vm');

const source=fs.readFileSync('admin.js','utf8');
const start=source.indexOf('function spreadsheetSafe');
const end=source.indexOf('function downloadAdminFile');
assert(start>=0&&end>start,'No se encontró el generador XLSX de Administración');

const context={Blob,TextEncoder};
vm.createContext(context);
vm.runInContext(`${source.slice(start,end)}\n;globalThis.createTestWorkbook=createXlsxBlob;`,context);

(async()=>{
  const blob=context.createTestWorkbook([
    ['Resumen',[['Campo','Valor'],['Cuatrimestre','Septiembre-Diciembre 2026']]],
    ['Por materia',[['Materia','Asesorías','Duración'],['Humanidades','25','3 h 29 min']]]
  ]);
  assert.strictEqual(blob.type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','El tipo MIME debe corresponder a XLSX');
  const bytes=new Uint8Array(await blob.arrayBuffer());
  assert.strictEqual(bytes[0],0x50,'El libro debe iniciar con la firma ZIP de XLSX');
  assert.strictEqual(bytes[1],0x4b,'El libro debe iniciar con la firma ZIP de XLSX');
  const binary=Buffer.from(bytes).toString('latin1');
  ['[Content_Types].xml','xl/workbook.xml','xl/styles.xml','xl/worksheets/sheet1.xml','xl/worksheets/sheet2.xml'].forEach(name=>assert(binary.includes(name),`Falta ${name} dentro del XLSX`));
  assert(source.includes("'reporte_asesorias.xlsx'")&&source.includes('estadisticas_asesorias_${safePeriod}.xlsx'),'Las dos exportaciones administrativas deben usar extensión XLSX');
  console.log('Exportaciones XLSX auténticas de Administración: OK');
})().catch(error=>{console.error(error);process.exit(1)});
