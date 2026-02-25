UPDATE receitas r
SET produto_categoria = p.categoria
FROM produtos_catalogo p
WHERE r.produto_id = p.id
AND r.produto_categoria IS NULL;