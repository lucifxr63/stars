# Validación experta — datos de la Corte Suprema en Animus

**Para:** abogado/a con experiencia en litigación ante la Corte Suprema
**Tiempo estimado:** 45–60 minutos
**Qué necesitamos:** que nos digas dónde estamos leyendo mal los datos.

No buscamos una aprobación. Buscamos que rompas lo que se pueda romper. Tenemos
1.706.941 registros y podemos calcular casi cualquier cosa con ellos; lo que no
tenemos es criterio para saber cuáles de esos cálculos significan algo y cuáles
son basura con formato de estadística.

---

## 1. Qué hay adentro

Datos de la API pública de estadísticas del Poder Judicial, años **2020 a 2025**,
11 libros. Las 1.706.941 filas son **tres series distintas** que no hay que
mezclar:

| Serie | Filas | Qué es |
|:---|---:|:---|
| Ingresos | 797.187 | causas que entraron |
| Inventario | 114.819 | causas pendientes al corte |
| Términos | 794.935 | causas falladas |

Una misma causa aparece en varias de estas series, y puede aparecer más de una
vez dentro de términos.

---

## 2. Cómo lo pruebas (10 minutos)

Vas a usar Claude Desktop. Te pasamos una **API key personal** por canal privado
(no va en este documento; sin ella no funciona nada).

1. Instala Claude Desktop.
2. Abre el archivo de configuración:
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
3. Pega esto, reemplazando la clave por la que te enviamos:

```json
{
  "mcpServers": {
    "animus-engine": {
      "command": "npx",
      "args": ["-y", "animus-engine-mcp"],
      "env": { "ANIMUS_API_KEY": "la_clave_que_te_enviamos" }
    }
  }
}
```

4. Reinicia Claude Desktop. Deberías ver el ícono de herramientas disponible.

Si algo falla, avísanos: el error también es información útil.

---

## 3. Las preguntas, en orden

Escríbelas tal cual en Claude Desktop. Después de cada una, lo que nos importa
no es si la respuesta suena bien, sino **si es defendible ante un colega tuyo**.

### Bloque A — ¿los números son los que deberían ser?

> **A1.** «Muéstrame las tendencias de la Corte Suprema año por año, y dime
> cuántas causas se fallaron en cada uno.»

> **A2.** «¿Cuántas causas ingresaron a la Corte Suprema en 2023 y cuántas se
> fallaron ese mismo año?»

> **A3.** «Dame el desglose de términos del libro Civil por resultado.»

**Lo que te pedimos:** ¿los órdenes de magnitud son creíbles para la Suprema?
Si un año se ve raro, dínoslo aunque no sepas por qué.

### Bloque B — las tres lecturas que necesitamos que dictamines

Estas son afirmaciones concretas que se pueden sacar de nuestros datos. Queremos
que digas **correcta / incorrecta / incompleta**, y por qué.

---

**Lectura 1 — «Ingresos menos términos da las causas pendientes.»**

Nosotros creemos que **es falsa**, porque una causa ingresada en un año puede
fallarse en otro. Si se hace esa resta, 2024 arroja un 153% de "resolución", que
es imposible. Creemos que el pendiente real es la serie de inventario.

Pregúntale:
> «¿Cuántas causas quedaron pendientes en la Corte Suprema en 2024? Explícame de
> dónde sacas ese número.»

**Lo que necesitamos de ti:** ¿el inventario del PJUD es efectivamente la medida
de causas pendientes que usarías tú? ¿O "inventario" en la nomenclatura del
Poder Judicial significa otra cosa?

---

**Lectura 2 — «Cada causa tiene un resultado.»**

Nosotros creemos que **es falsa**. La misma causa puede figurar como ingresada,
en inventario, y con más de un término, con distinto resultado cada vez.

Pregúntale por un caso real que ya verificamos:
> «Muéstrame la historia completa de la causa Civil rol 289-2023 de la Corte
> Suprema y explícame qué pasó en cada registro.»

Debería devolverte **5 filas**: un ingreso, dos cortes de inventario, y dos
términos del mismo recurso de Casación en la Forma:

| Fecha de fallo | Resultado |
|:---|:---|
| 2023-08-16 | Inadmisible |
| 2025-01-24 | Rechazado |

**Lo que necesitamos de ti**, y es lo que menos sabemos:
1. ¿Tiene sentido que un mismo rol se declare inadmisible en agosto de 2023 y
   se rechace 17 meses después? ¿Es reposición, son dos recursos distintos bajo
   el mismo rol, o es un problema de los datos?
2. Cuando hay dos términos con resultados distintos, ¿cuál vale? ¿El último por
   fecha, o depende del tipo de recurso?
3. Esto contamina directamente la "duración media entre ingreso y fallo": según
   cuál de los dos fallos se tome, esta causa dura 8 meses o 25.

---

**Lectura 3 — «El 51% de lo que falla la Suprema termina revocado.»**

Ese número sale de nuestros datos y creemos que **es cierto pero engañoso**,
porque esconde de qué está hecho.

Primero: el vocabulario de resultados cambia según el **tipo de recurso**, no
según el libro. Dentro del mismo libro Civil conviven ambos mundos:

| Tipo de recurso | Términos | Confirmado/Revocado | Inadmisible/Rechazado/Acogido |
|:---|---:|---:|---:|
| (Civil) Apelación Protección | 694.025 | 97,8% | 2,1% |
| (Civil) Casación Fondo | 14.647 | 0,0% | 89,6% |
| (Civil) Casación Forma y Fondo | 4.584 | 0,0% | 91,5% |
| Reforma Laboral (todo el libro) | 11.100 | 0,4% | 91,6% |

Segundo: **694.025 de los 794.935 términos —el 87,3% de todo— son un solo tipo
de recurso, la apelación de protección.** O sea que "la Suprema revoca el 51%"
es, en los hechos, un número sobre recursos de protección. El resto de la
judicatura apenas mueve la aguja del promedio.

Tercero, y es lo que de verdad nos frenó: **ese porcentaje no es estable**. Año
a año, y mirando sólo apelación de protección para descartar que sea un cambio
de composición:

| Año | Términos de protección | % revocados (protección) |
|---:|---:|---:|
| 2020 | 139.332 | 17,0% |
| 2021 | 90.331 | 35,4% |
| 2022 | 131.057 | **80,6%** |
| 2023 | 226.902 | **80,0%** |
| 2024 | 77.989 | 53,8% |
| 2025 (parcial) | 28.414 | 20,0% |

Dentro del mismo tipo de recurso, la revocación se multiplica por 4,7 y después
vuelve a bajar. Eso no parece deriva jurisprudencial, y un promedio de 56% sobre
una serie así no describe nada.

Tenemos una hipótesis, y es tuya para confirmar o descartar: 2022–2023 coincide
con la ola masiva de recursos de protección contra **isapres** (alzas de planes,
tabla de factores), donde la Suprema habría revocado sistemáticamente a las
Cortes de Apelaciones. El volumen acompaña: la protección pasa de 139.332
términos en 2020 a 226.902 en 2023.

Pregúntale:
> «¿Qué porcentaje de causas revoca la Corte Suprema, año por año, en apelación
> de protección?»

**Lo que necesitamos de ti:**
1. ¿La ola de isapres explica el salto de 2022–2023, o hay que buscar el error
   en nuestros datos? Esta es **la pregunta más importante de todo el
   documento**.
2. Si es real: ¿tiene sentido publicar un promedio 2020-2025, o hay que romper
   la serie en dos períodos?
3. ¿Es correcto que confirmar/revocar aplica a la vía de apelación, y que en
   casación y unificación lo propio es inadmisible/rechazado/acogido?
4. Si tuvieras que titular esta estadística con **una** cifra, ¿cuál sería? Si
   la respuesta es "ninguna", también sirve.

---

### Bloque C — rompe lo que puedas

> **C1.** «¿Cuánto se demora la Corte Suprema en fallar una causa?»

> **C2.** «Compara la Tercera Sala con la Cuarta Sala.»

> **C3.** Cualquier pregunta que le harías a un pasante para ver si entendió el
> tema.

**Lo que te pedimos:** marca cualquier respuesta que **suene autorizada pero sea
imprecisa**. Ese es el riesgo que más nos importa: no que el sistema diga "no
sé", sino que responda con seguridad algo que un tribunal no aceptaría.

---

## 4. Lo que ya sabemos que falta

Para que no gastes tiempo reportándolo:

- **No hay texto de sentencias.** Sólo estadística agregada: rol, libro, tipo de
  recurso, sala, fechas, resultado. No se puede citar un considerando.
- **Sólo Corte Suprema.** No hay Cortes de Apelaciones ni primera instancia.
- **No hay materia sustantiva.** No podemos decir "causas sobre despido
  injustificado": no está en la fuente. Si nos dices que esto es indispensable,
  cambia nuestras prioridades.
- **Hasta 2025.** No es tiempo real.

---

## 5. Cómo devolvernos esto

Con que anotes al lado de cada pregunta te sirve. Lo que más valor tiene:

1. Las tres lecturas del Bloque B: correcta / incorrecta / incompleta.
2. Cualquier respuesta que te haya parecido segura de sí misma y equivocada.
3. Una frase sobre para qué **no** deberíamos vender esto.

Gracias. Preferimos enterarnos ahora de que algo está mal planteado que después
de que alguien tome una decisión con estos números.
