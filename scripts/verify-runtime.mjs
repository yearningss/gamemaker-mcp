import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GameMakerConnection } from '../runtime/server/build/gamemaker-connection.js';
import { registerMetaTools } from '../runtime/server/build/tool-registry.js';
const s=new McpServer({name:'test',version:'1'});registerMetaTools(s,new GameMakerConnection());
const [a,b]=InMemoryTransport.createLinkedPair();const c=new Client({name:'test',version:'1'});await s.connect(a);await c.connect(b);
try {const result=await c.callTool({name:'list_tool_categories',arguments:{}});const cats=JSON.parse(result.content[0].text);for(const cat of cats){const r=await c.callTool({name:'load_category',arguments:{category:cat.category}});if(r.isError)throw Error(JSON.stringify(r));}const tools=(await c.listTools()).tools;
assert.equal(tools.length, cats.reduce((sum, cat) => sum + cat.toolCount, 2));
assert.equal(tools.length, 249);
for (const name of ['get_memory_usage','get_draw_calls','execute_gml','evaluate_expression','set_instance_variable_value','get_ds_memory_estimate','get_texture_page_info']) assert.ok(!tools.some(tool => tool.name === name), name);
assert.ok(tools.some(tool => tool.name === 'set_instance_variable'));
console.log(JSON.stringify({categories:cats.length,registeredTools:tools.length}));}finally{await c.close();await s.close();}

