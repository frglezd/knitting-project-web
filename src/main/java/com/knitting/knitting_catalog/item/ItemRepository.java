package com.knitting.knitting_catalog.item;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ItemRepository extends JpaRepository<Item, Integer> {
    Optional<Item> findByNombre(String nombre);

    Optional<Item> findById(int id);

    void deleteByNombre(String nombre);
}
