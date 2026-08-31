package com.knitting.knitting_catalog.item;

import java.util.Optional;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Component
public class ItemService {

    private final ItemRepository itemRepository;

    @Autowired
    public ItemService(ItemRepository itemRepository){
        this.itemRepository = itemRepository;
    }

    public List<Item> getItems(){
        return itemRepository.findAll();
    }

    public Optional<Item> getItemById(int itemId){
        return itemRepository.findById(itemId);
    }

    public List<Item> getItemsFromCategoria(String categoriaName){
        return itemRepository.findAll()
                .stream()
                .filter(item -> categoriaName.equals(item.getCategoria()))
                .collect(Collectors.toList());

    }

    public List<Item> getItemsByNombre(String searchText){
        return itemRepository.findAll()
                .stream()
                .filter(item -> item.getNombre().toLowerCase().contains(searchText.toLowerCase()))
                .collect(Collectors.toList());

    }

    public List<Item> getItemsByCategoria(String searchText){
        return itemRepository.findAll()
                .stream()
                .filter(item -> item.getCategoria().toLowerCase().contains(searchText.toLowerCase()))
                .collect(Collectors.toList());

    }

    public Item addItem(Item item){
        itemRepository.save(item);
        return item;
    }

    public Item updateItem(Item updatedItem){
        Optional<Item> existingItem = itemRepository.findByNombre(updatedItem.getNombre());

        if(existingItem.isPresent()){
            Item itemToUpdate = existingItem.get();
            itemToUpdate.setNombre(updatedItem.getNombre());
            itemToUpdate.setCategoria(updatedItem.getCategoria());
            itemToUpdate.setDescripcion(updatedItem.getDescripcion());
            itemToUpdate.setFabricante(updatedItem.getFabricante());
            itemToUpdate.setImagen(updatedItem.getImagen());
            itemToUpdate.setPrecio(updatedItem.getPrecio());
            itemToUpdate.setUnidadPrecio(updatedItem.getUnidadPrecio());

            itemRepository.save(itemToUpdate);
            return itemToUpdate;
        }

        return null;
    }

    @Transactional
    public void deleteItem(String deletedItem){
        itemRepository.deleteByNombre(deletedItem);

    }

    @Transactional
    public void deleteItemById(int itemId){
        itemRepository.deleteById(itemId);

    }
}
