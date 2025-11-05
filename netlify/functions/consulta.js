const { Client } = require('pg');

// La funció 'handler' és el punt d'entrada per a Netlify Functions
exports.handler = async (event, context) => {
  // 1. Obtenir la cadena de connexió de la variable d'entorn
  const connectionString = process.env.NEON_DATABASE_URL;

  if (!connectionString) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "La variable d'entorn NEON_DATABASE_URL no està configurada.",
      }),
    };
  }

  // 2. Crear i connectar el client
  const client = new Client({
    connectionString: connectionString,
    // Usar SSL és crucial per a Neon i AWS Lambda
    ssl: {
      rejectUnauthorized: false,
    },
  });
  try {
    await client.connect();

    // 3. Executar la consulta a la base de dades
    // Exemple de consulta: seleccionar totes les files d'una taula anomenada 'usuaris'
    const result = await client.query('SELECT * FROM test LIMIT 10;');

    // 4. Retornar les dades amb èxit
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(result.rows),
    };
  } catch (error) {
    console.error('Error en la consulta a Neon DB:', error);

    // 5. Retornar un error
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Error en la comunicació amb la base de dades.',
        details: error.message, // Només exposeu detalls d'error si és segur
      }),
    };
  } finally {
    // Assegurar-se de tancar la connexió
    if (client) {
      await client.end();
    }
  }
};
