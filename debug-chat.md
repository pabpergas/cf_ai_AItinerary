# Debug: Sistema de Múltiples Chats

## Problema Actual
Los chats no cargan correctamente cuando haces click en un chat existente desde el sidebar.

## Cómo Funciona el Sistema

### 1. Durable Objects (DO)
- Cada conversación = 1 Durable Object único
- El DO se identifica por su **name** (el `conversationId`)
- El DO tiene una tabla SQLite interna: `cf_ai_chat_agent_messages`
- Los mensajes se guardan automáticamente en esa tabla

### 2. Flujo Actual

**useAgent hook:**
```tsx
const agent = useAgent({
  agent: "chat",
  name: conversationId || userId,  // 👈 Este es el ID del DO
  query: { token: user?.token ?? "" }
});
```

**Backend (server.ts):**
```tsx
export class Chat extends AIChatAgent<Env> {
  constructor(ctx, env) {
    super(ctx, env);
    // Carga mensajes de cf_ai_chat_agent_messages
    this.messages = loadFromSQL();
  }
}
```

### 3. Identificación del Problema

El DO se crea con: `env.Chat.idFromName(conversationId)`

**Posibles causas:**
1. ✅ El `name` no se pasa correctamente → **Verificado: SÍ se pasa**
2. ❓ El componente no se re-monta → **Arreglado con key prop**
3. ❓ El DO no carga los mensajes correctamente
4. ❓ Los mensajes no se guardaron en primer lugar

### 4. Para Verificar

**En el navegador:**
1. Abre DevTools → Console
2. Haz click en un chat existente
3. Verifica los logs del worker (wrangler tail)
4. Comprueba:
   - ¿Se llama al constructor del DO?
   - ¿this.messages.length es > 0?
   - ¿El conversationId es correcto?

**Comandos útiles:**
```bash
# Ver logs en tiempo real
npx wrangler tail --format pretty

# Ver Durable Objects activos
npx wrangler d1 execute aitinerary-db --remote --command "SELECT * FROM chat_conversations LIMIT 10"
```

### 5. Posible Solución

Si los mensajes no se cargan, puede ser que:
1. El DO se está creando con un ID diferente cada vez
2. Los mensajes se guardan pero no se leen en el constructor
3. Hay un problema con el lifecycle del DO

**Debug adicional en server.ts:**
```typescript
constructor(ctx: AgentContext, env: Env) {
  super(ctx, env);
  console.log('[Chat DO] Constructor called');
  console.log('[Chat DO] ID:', this.ctx.id.toString());
  console.log('[Chat DO] Messages count:', this.messages.length);
}
```

### 6. Test Manual

1. Crea un nuevo chat
2. Envía 2-3 mensajes
3. Ve a "New chat"
4. Haz click en el chat anterior
5. ¿Aparecen los mensajes?

Si NO aparecen:
- El DO se está creando con otro ID
- Los mensajes no se guardaron
- El componente no se re-monta

Si SÍ aparecen pero solo a veces:
- Problema de race condition
- Cache del navegador
