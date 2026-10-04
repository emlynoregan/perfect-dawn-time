import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync, statSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";

const root=resolve(fileURLToPath(new URL("../source/",import.meta.url)));
const base="https://pdt-bronzearch.house-of-ur.com";
const pages=new Map([
  ["index.html",["/","home"]],
  ["how-it-works.html",["/how-it-works.html","how-it-works"]],
  ["equation-of-time.html",["/equation-of-time.html","equation-of-time"]],
  ["adjustments.html",["/adjustments.html","adjustments"]],
  ["converter.html",["/converter.html","converter"]],
]);

function metadata(html, type, name) {
  const expr=new RegExp('<meta\\s+'+type+'="'+name+'"\\s+content="([^"]*)"\\s*>',"g");
  const matches=[...html.matchAll(expr)];
  assert.equal(matches.length,1,name+" missing or duplicated");
  return matches[0][1];
}

function assertPng(name,width,height) {
  const file=resolve(root,name);
  const data=readFileSync(file);
  assert.equal(data.subarray(0,8).toString("hex"),"89504e470d0a1a0a",name+" not PNG");
  assert.equal(data.readUInt32BE(16),width,name+" wrong width");
  assert.equal(data.readUInt32BE(20),height,name+" wrong height");
  assert.ok(statSync(file).size<4_000_000,name+" too large");
}

test("each PDT page has an absolute, self-hosted social preview and coherent metadata",()=>{
  for(const [filename,[path,stem]] of pages){
    const html=readFileSync(resolve(root,filename),"utf8");
    const canonical=base+path;
    const imageUrl=base+"/social/"+stem+".png";
    assert.ok(html.includes('<link rel="canonical" href="'+canonical+'">'));
    assert.equal(metadata(html,"property","og:type"),"website");
    assert.equal(metadata(html,"property","og:site_name"),"Perfect Dawn Time");
    assert.equal(metadata(html,"property","og:locale"),"en_AU");
    assert.equal(metadata(html,"property","og:url"),canonical);
    assert.equal(metadata(html,"property","og:image"),imageUrl);
    assert.equal(metadata(html,"property","og:image:secure_url"),imageUrl);
    assert.equal(metadata(html,"property","og:image:width"),"1200");
    assert.equal(metadata(html,"property","og:image:height"),"630");
    assert.equal(metadata(html,"property","og:image:type"),"image/png");
    assert.ok(metadata(html,"property","og:image:alt").length>15);
    const title=metadata(html,"property","og:title");
    const description=metadata(html,"property","og:description");
    assert.ok(title.length>20 && title.length<100,title);
    assert.ok(description.length>60 && description.length<190,description);
    assert.equal(metadata(html,"name","twitter:card"),"summary_large_image");
    assert.equal(metadata(html,"name","twitter:title"),title);
    assert.equal(metadata(html,"name","twitter:description"),description);
    assert.equal(metadata(html,"name","twitter:image"),imageUrl);
    assert.equal(metadata(html,"name","twitter:image:alt"),metadata(html,"property","og:image:alt"));
    assert.match(html,/<link rel="icon" type="image\/png" sizes="32x32" href="\.\/favicon-32\.png">/);
    assert.match(html,/<link rel="apple-touch-icon" sizes="180x180" href="\.\/apple-touch-icon\.png">/);
    assertPng("social/"+stem+".png",1200,630);
  }
});

test("raster favicon fallbacks exist and SVG favicon is non-empty",()=>{
  assertPng("favicon-32.png",32,32);
  assertPng("apple-touch-icon.png",180,180);
  assertPng("icon-512.png",512,512);
  assert.match(readFileSync(resolve(root,"icon.svg"),"utf8"),/<svg[^>]*>/);
  assert.match(readFileSync(resolve(root,"icon.svg"),"utf8"),/<circle /);
});
