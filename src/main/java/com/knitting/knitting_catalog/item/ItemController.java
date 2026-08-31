package com.knitting.knitting_catalog.item;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping(path="api/v1/item")
public class ItemController {
    private final ItemService itemService;

    @Autowired
    public ItemController(ItemService itemService){
        this.itemService = itemService;

    }

    @GetMapping
    public List<Item> getItems(@RequestParam(required = false) String nombre){
        if(nombre != null){
            return itemService.getItemsByNombre(nombre);
        }else{
            return itemService.getItems();
        }
    }



    @GetMapping("/{itemId}")
    public ResponseEntity<Item> getItemById(@PathVariable int itemId){
        return itemService.getItemById(itemId)
                .map(item -> new ResponseEntity<>(item, HttpStatus.OK))
                .orElseGet(() -> new ResponseEntity<>(HttpStatus.NOT_FOUND));
    }

    @PostMapping
    public ResponseEntity<Item> addItem(@RequestBody Item item){
        Item createdItem = itemService.addItem(item);

        return new ResponseEntity<>(createdItem, HttpStatus.CREATED);
    }

    @DeleteMapping("/{itemName}")
    public ResponseEntity<String> deleteItem(@PathVariable String itemName){
        itemService.deleteItem(itemName);
        return new ResponseEntity<>("Item deleted successfully", HttpStatus.OK);
    }

    @DeleteMapping("/id/{itemId}")
    public ResponseEntity<String> deleteItemById(@PathVariable int itemId){
        itemService.deleteItemById(itemId);
        return new ResponseEntity<>("Item deleted successfully", HttpStatus.OK);
    }
}
