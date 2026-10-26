-- Migration 184_library_views_v_crates_etc_down.sql

DROP VIEW IF EXISTS library.v_crates;
DROP VIEW IF EXISTS library.v_source_yield;
DROP VIEW IF EXISTS library.v_review_queue;
DROP VIEW IF EXISTS library.v_buy_list;
