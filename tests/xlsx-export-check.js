const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const ExcelJS=require('../exceljs.min.js');

const source=fs.readFileSync('admin.js','utf8');
const safeStart=source.indexOf('function spreadsheetSafe');
const generatorStart=source.indexOf('async function createStandardXlsxBlob');
const safeEnd=generatorStart;
const generatorEnd=source.indexOf('async function exportExcel');
assert(safeStart>=0&&safeEnd>safeStart&&generatorStart>=0&&generatorEnd>generatorStart,'No se encontró el generador XLSX estándar');

const context={Blob,ExcelJS,Date};
vm.createContext(context);
vm.runInContext(`${source.slice(safeStart,safeEnd)}\n${source.slice(generatorStart,generatorEnd)}\n;globalThis.createTestWorkbook=createStandardXlsxBlob;`,context);

(async()=>{
  const blob=await context.createTestWorkbook([
    ['Resumen',[['Campo','Valor'],['Período','Septiembre-Diciembre 2026']]],
    ['Por materia',[['Materia','Asesorías','Duración'],['Humanidades','25','3 h 29 min']]]
  ]);
  assert.strictEqual(blob.type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','El tipo MIME debe corresponder a XLSX');
  const bytes=Buffer.from(await blob.arrayBuffer());
  const workbook=new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  assert.deepStrictEqual(workbook.worksheets.map(sheet=>sheet.name),['Resumen','Por materia'],'El XLSX debe conservar todas las hojas');
  assert.strictEqual(workbook.getWorksheet('Resumen').getCell('A2').value,'Período','El XLSX debe conservar acentos y datos');
  assert(source.includes("'reporte_asesorias.xlsx'")&&source.includes('estadisticas_asesorias_${safePeriod}.xlsx'),'Las dos exportaciones administrativas deben usar extensión XLSX');
  assert(source.includes('createStandardXlsxBlob'),'Las exportaciones deben usar el motor XLSX estándar');
  assert(fs.existsSync('exceljs.min.js')&&fs.statSync('exceljs.min.js').size>500000,'La biblioteca XLSX local debe incluirse completa');
  console.log('Exportaciones XLSX estándar de Administración: OK');
})().catch(error=>{console.error(error);process.exit(1)});
