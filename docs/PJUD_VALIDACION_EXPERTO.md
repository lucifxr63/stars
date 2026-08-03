# Corte Suprema — qué construimos y qué necesitamos que nos digas

Documento para revisión de alguien con criterio en el área. No hace falta saber
nada de la parte técnica.

**Lo que pedimos:** que juzgues si los números **significan** lo que creemos que
significan. Los números en sí ya están verificados contra la fuente; lo que no
sabemos es si nuestra lectura es correcta o ingenua.

---

## 1. De dónde sale el dato

Todo viene de la **API pública de estadísticas del Poder Judicial**
(`estadisticaservices.pjud.cl`), sin intermediarios, sin scraping y sin
transformar valores. Bajamos tres series de la Corte Suprema, por año, entre
2020 y 2025:

| serie | qué contiene | filas |
|---|---|---|
| `terminos_suprema_detalle` | causas falladas, con fecha de fallo, sala y grupo de término | 794.935 |
| `ingresos_recursos_suprema_detalle` | recursos ingresados, con **materia** | 797.187 |
| `inventario_suprema_detalle` | causas en inventario (pendientes) | 114.819 |

**Total: 1.706.941 registros**, uno por causa. No son agregados: cada fila es una
causa con su rol, libro, tipo de recurso y fechas.

Verificamos año por año que lo que guardamos coincide **exactamente** con lo que
entrega la fuente. Las únicas diferencias son filas que la fuente publica
repetidas (3 en 2022, 1 en 2025), que descartamos.

### Lo que NO hicimos

- No interpretamos ni reclasificamos nada. Las categorías (`Confirmados`,
  `Revocados`, materias, salas) son las que usa el PJUD.
- No completamos huecos. Si un campo viene vacío, queda vacío.
- No cruzamos causas con leyes. **No existe ningún campo que vincule una causa
  con una norma**, así que no lo inventamos (ver §4).

---

## 2. Las tres afirmaciones que necesitamos que juzgues

### A. La tasa de confirmación se desplomó y se recuperó

Proporción de fallos **confirmados** sobre el total de términos del año:

| año | términos | confirmados | duración media (ingreso→fallo) |
|---|---|---|---|
| 2020 | 150.985 | **70,2 %** | 83 días |
| 2021 | 105.963 | 57,2 % | 40 días |
| 2022 | 147.088 | **21,1 %** | 62 días |
| 2023 | 243.775 | **20,7 %** | 138 días |
| 2024 | 95.075 | 43,7 % | 92 días |
| 2025 | 52.049 | 59,2 % | 71 días |

**Preguntas:**

1. ¿Una caída de 70 % a 21 % en dos años es plausible como cambio real de
   criterio, o hay una explicación más aburrida — por ejemplo, que el PJUD haya
   cambiado cómo etiqueta los términos?
2. ¿"Confirmados" y "Revocados" significan lo que un no abogado supone
   (se mantiene / se deja sin efecto la resolución de la corte inferior)?
3. La duración media salta a 138 días en 2023, justo el año de mayor volumen.
   ¿Es esperable, o 138 días es anormal para la Suprema?

### B. Cuatro de cada cinco recursos son de Isapres

Materia de los recursos **ingresados**:

| año | ingresos | Isapres | % |
|---|---|---|---|
| 2020 | 154.883 | 138.332 | 89,3 % |
| 2021 | 97.186 | 74.800 | 77,0 % |
| 2022 | 171.875 | 149.430 | 86,9 % |
| 2023 | 252.722 | **223.929** | 88,6 % |
| 2024 | 62.009 | 35.076 | 56,6 % |
| 2025 | 58.512 | **18.827** | 32,2 % |

De 223.929 a 18.827 en dos años: **−92 %**.

**Preguntas:**

4. ¿Es correcto atribuir la caída a la Ley Corta de Isapres (21.674), o hay
   otras causas — represamiento en cortes de apelaciones, cambio de criterio de
   admisibilidad, otra reforma?
5. ¿Un 89 % de la carga de la Corte Suprema en una sola materia es un dato
   conocido en el área, o suena exagerado y conviene revisar cómo contamos?
6. Las variantes ("Isapres, Factor Mujer", "Factor Hombre", "Incorporación de
   Recién Nacido") ¿son subtipos legítimos que conviene sumar, o categorías que
   no deberían agruparse?

### C. La competencia por sala es rígida

Medido sobre 794.935 causas falladas:

| recurso | sala | concentración |
|---|---|---|
| Apelación Protección | Tercera (Constitucional) | **100 %** |
| Apelación Amparo | Segunda (Penal) | **100 %** |
| Unificación de Jurisprudencia | Cuarta (Mixta) | **100 %** |
| Casación Fondo (Civil) | Primera (Civil) | 67,9 % |

**Preguntas:**

7. ¿Estas asignaciones son la competencia formal de cada sala, o hay excepciones
   que el dato no refleja?
8. Casación Fondo Civil aparece repartida (67,9 % en la Primera). ¿Es normal?

---

## 3. Cómo comprobarlo por su cuenta

Cada afirmación se puede reproducir con una consulta. No hace falta instalar
nada: pegar la línea en un navegador o pedirle a alguien que la corra.

**Base:** `https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1`
**Autenticación:** cabecera `Authorization: Bearer demo_public_key`

| qué comprueba | consulta |
|---|---|
| La serie completa de confirmación y duración | `GET /data/pjud/suprema/tendencias` |
| Sólo apelaciones de protección | `GET /data/pjud/suprema/tendencias?tipo_recurso=Protección` |
| Sólo la Sala Constitucional | `GET /data/pjud/suprema/tendencias?sala=CONSTITUCIONAL` |
| Totales por año, sala, libro y tipo | `GET /data/pjud/suprema/resumen` |
| Causas concretas, filtrables | `GET /data/pjud/suprema/causas?anio=2023&grupo_termino=Revocados` |
| Una causa puntual, con toda su historia | `GET /data/pjud/suprema/causas/Reforma/11425/2025` |

Ese último caso es útil para ver el grano: devuelve **cuatro filas** para la
misma causa —ingresó, estuvo en inventario y se falló dos veces, con distinto
resultado cada vez—. Si eso no debería pasar, es justo lo que necesitamos saber.

**Contraste directo con la fuente**, sin pasar por nosotros:
`https://estadisticaservices.pjud.cl/pjen/terminos_suprema_detalle/1/2023`

---

## 4. Lo que deliberadamente no hicimos, y donde más falta tu criterio

El sistema tiene un buscador que responde preguntas legales combinando
**normativa** (Ley 21.521 Fintech, 21.719 Datos, 21.663 Ciberseguridad, Karin)
con estas estadísticas.

Lo que **no** hicimos es unir causas con leyes. Sería lo más vistoso —"los
recursos de protección se relacionan con la ley tal"— y sería **inventado**: en
los datos del PJUD no hay ningún campo que vincule una causa con una norma.
Afirmarlo dentro de un sistema que después redacta respuestas equivale a
fabricar doctrina, y el sistema la repetiría con total seguridad.

**Preguntas:**

9. ¿Existe una forma legítima de mapear la **materia** de una causa a un cuerpo
   normativo? Por ejemplo: materia "Isapres" → DFL 1/2005 y Ley 21.674.
10. Si existe, ¿lo harías por materia, o eso también es demasiado grueso?
11. ¿Qué otra dimensión del dato debería estar y no está? Tenemos rol, libro,
    año de rol, tipo de recurso, código de recurso, sala, fecha de ingreso,
    fecha de fallo, grupo de término y materia.

---

## 5. Resumen de lo que pedimos

- Confirmar o desmentir las tres lecturas de §2.
- Decir si alguna es **técnicamente cierta pero engañosa** — ese es el riesgo
  que más nos preocupa.
- Responder §4 si hay una forma honesta de conectar causas con normas.

Preferimos un "ese número está bien pero no significa eso" hoy, que una
propuesta comercial construida sobre una lectura equivocada.
