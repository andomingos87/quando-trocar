-- Cobre a FK oficinas.plano_id (advisor unindexed_foreign_keys).
create index oficinas_plano_id_idx on oficinas(plano_id);
