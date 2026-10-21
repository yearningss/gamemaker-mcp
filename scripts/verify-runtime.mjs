import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GameMakerConnection } from '../runtime/server/build/gamemaker-connection.js';
import { registerMetaTools } from '../runtime/server/build/tool-registry.js';
const s=new McpServer({name:'test',version:'1'});registerMetaTools(s,new GameMakerConnection());
const [a,b]=InMemoryTransport.createLinkedPair();const c=new Client({name:'test',version:'1'});await s.connect(a);await c.connect(b);
try {const result=await c.callTool({name:'list_tool_categories',arguments:{}});const cats=JSON.parse(result.content[0].text);for(const cat of cats){const r=await c.callTool({name:'load_category',arguments:{category:cat.category}});if(r.isError)throw Error(JSON.stringify(r));}console.log(JSON.stringify({categories:cats.length,registeredTools:(await c.listTools()).tools.length}));}finally{await c.close();await s.close();}

