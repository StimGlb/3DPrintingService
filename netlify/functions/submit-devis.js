// netlify/functions/submit-devis.js
const { Client } = require('pg');

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Parse form data
  let formData;
  try {
    formData = JSON.parse(event.body);
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON' })
    };
  }

  // Connexion à Neon
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Insérer la demande principale
    const insertQuery = `
      INSERT INTO demandes_devis (
        nom, prenom, email, telephone, ville,
        description, dimensions, quantite, couleur, 
        resistance, budget, urgence, commentaires
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `;

    const values = [
      formData.nom,
      formData.prenom,
      formData.email,
      formData.telephone || null,
      formData.ville,
      formData.description,
      formData.dimensions || null,
      formData.quantite || '1',
      formData.couleur || null,
      formData.resistance || 'normale',
      formData.budget || null,
      formData.urgence || 'normale',
      formData.commentaires || null
    ];

    const result = await client.query(insertQuery, values);
    const demandeId = result.rows[0].id;

    // Insérer les catégories si présentes
    if (formData.categories && Array.isArray(formData.categories)) {
      const categoryPromises = formData.categories.map(categorie => {
        return client.query(
          'INSERT INTO categories_demande (demande_id, categorie) VALUES ($1, $2)',
          [demandeId, categorie]
        );
      });
      await Promise.all(categoryPromises);
    }

    await client.end();

    // Retour succès
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Demande enregistrée avec succès',
        demandeId: demandeId
      })
    };

  } catch (error) {
    console.error('Erreur base de données:', error);
    
    if (client) {
      await client.end();
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Erreur lors de l\'enregistrement',
        details: error.message
      })
    };
  }
};
