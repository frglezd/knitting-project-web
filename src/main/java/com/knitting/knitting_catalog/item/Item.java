package com.knitting.knitting_catalog.item;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;

@Entity
@Table(name="catalogo")
public class Item {
    @Column(name = "descripcion", length = Integer.MAX_VALUE)
    private String descripcion;
    @Column(name = "unidad_precio", nullable = false, length = 20)
    private String unidadPrecio;
    @Column(name = "precio", nullable = false, precision = 10, scale = 2)
    private BigDecimal precio;
    @Column(name = "imagen", length = Integer.MAX_VALUE)
    private String imagen;
    @Column(name = "categoria", nullable = false, length = 100)
    private String categoria;
    @Column(name = "fabricante", nullable = false, length = 150)
    private String fabricante;
    @Column(name = "nombre", nullable = false, length = 150)
    private String nombre;
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, unique = true)
    private Integer id;

    public Item() {
    }

    public Item(String descripcion, String unidadPrecio, BigDecimal precio, String imagen, String categoria, String fabricante, String nombre, Integer id) {
        this.descripcion = descripcion;
        this.unidadPrecio = unidadPrecio;
        this.precio = precio;
        this.imagen = imagen;
        this.categoria = categoria;
        this.fabricante = fabricante;
        this.nombre = nombre;
        this.id = id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public void setDescripcion(String descripcion) {
        this.descripcion = descripcion;
    }

    public String getUnidadPrecio() {
        return unidadPrecio;
    }

    public void setUnidadPrecio(String unidadPrecio) {
        this.unidadPrecio = unidadPrecio;
    }

    public BigDecimal getPrecio() {
        return precio;
    }

    public void setPrecio(BigDecimal precio) {
        this.precio = precio;
    }

    public String getImagen() {
        return imagen;
    }

    public void setImagen(String imagen) {
        this.imagen = imagen;
    }

    public String getCategoria() {
        return categoria;
    }

    public void setCategoria(String categoria) {
        this.categoria = categoria;
    }

    public String getFabricante() {
        return fabricante;
    }

    public void setFabricante(String fabricante) {
        this.fabricante = fabricante;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public Integer getId() {
        return id;
    }


}
