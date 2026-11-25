const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{X509Certificate}=require('node:crypto');
const root=path.resolve(__dirname,'..');
assert.equal(process.versions.node.split('.')[0],'22','Se requiere Node.js 22.x');
for(const name of ['server.js','app.js','admin.js','index.html','admin.html','styles.css','logo-iehl.jpg','logo-bis-universities.png','exceljs.min.js','lib/pagination.js','lib/draft-period.js'])assert(fs.statSync(path.join(root,name)).size>0,name);
require('node:child_process').execFileSync(process.execPath,['--check',path.join(root,'server.js')],{stdio:'inherit'});
for(const name of ['lib/pagination.js','lib/draft-period.js']) require(path.join(root,name));
for(const name of ['pg','bcryptjs']) require(require.resolve(name,{paths:[root]}));
if(process.env.NODE_EXTRA_CA_CERTS){const pem=fs.readFileSync(process.env.NODE_EXTRA_CA_CERTS,'utf8');const certs=pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g)||[];assert(certs.length,'CA PEM ausente');for(const pem of certs){const cert=new X509Certificate(pem);assert(Date.parse(cert.validFrom)<=Date.now()&&Date.parse(cert.validTo)>Date.now(),'CA fuera de vigencia')}}
console.log('Preflight: Node, archivos, dependencias y CA configurada comprobados; no establece conexión a PostgreSQL.');
